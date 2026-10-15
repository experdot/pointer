/**
 * AI 供应商适配层
 *
 * 目前实现 OpenAI 兼容协议（OpenAI / DeepSeek / 兼容网关等）；
 * 协议差异全部收敛在本文件，ChatEngine 只面对统一接口。
 */

import { createParser } from 'eventsource-parser'
import type { MessageRole, ModelParameters, ProviderConnection } from '@shared/domain'
import { RuntimeError } from '@shared/contracts'

export type ProviderContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ProviderMessage {
  role: MessageRole
  content: string | ProviderContentPart[]
}

export interface StreamHandlers {
  onDelta: (text: string) => void
  onReasoning: (text: string) => void
}

function endpoint(connection: ProviderConnection, path: string): string {
  return `${connection.baseUrl.replace(/\/+$/, '')}${path}`
}

function authHeaders(connection: ProviderConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${connection.apiKey}`
  }
}

async function describeHttpError(response: Response): Promise<string> {
  try {
    const body = await response.text()
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string }
      return parsed.error?.message ?? parsed.message ?? body
    } catch {
      return body || response.statusText
    }
  } catch {
    return response.statusText
  }
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string; reasoning?: string }
  }>
  reasoning_content?: string
  reasoning?: string
}

/**
 * 流式请求；返回完整文本
 */
export async function streamChat(
  connection: ProviderConnection,
  parameters: ModelParameters,
  messages: readonly ProviderMessage[],
  signal: AbortSignal,
  handlers: StreamHandlers
): Promise<{ content: string; reasoning: string }> {
  const response = await fetch(endpoint(connection, '/chat/completions'), {
    method: 'POST',
    headers: authHeaders(connection),
    body: JSON.stringify({
      model: connection.modelName,
      messages: withSystemPrompt(messages, parameters),
      temperature: parameters.temperature,
      top_p: parameters.topP,
      stream: true
    }),
    signal
  })

  if (!response.ok) {
    throw new RuntimeError(
      'ai.http-error',
      `HTTP ${response.status}: ${await describeHttpError(response)}`
    )
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new RuntimeError('ai.no-body', '响应缺少可读流')
  }

  let content = ''
  let reasoning = ''

  const parser = createParser({
    onEvent: (event) => {
      if (event.data === '[DONE]') return

      let chunk: ChatCompletionChunk
      try {
        chunk = JSON.parse(event.data) as ChatCompletionChunk
      } catch {
        return
      }

      const delta = chunk.choices?.[0]?.delta
      const text = delta?.content
      const reasoningText =
        delta?.reasoning_content ?? delta?.reasoning ?? chunk.reasoning_content ?? chunk.reasoning

      if (text) {
        content += text
        handlers.onDelta(text)
      }
      if (reasoningText) {
        reasoning += reasoningText
        handlers.onReasoning(reasoningText)
      }
    }
  })

  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.feed(decoder.decode(value, { stream: true }))
    }
  } catch (error) {
    if (isAbortError(error)) {
      return { content, reasoning }
    }
    throw error
  }

  return { content, reasoning }
}

export function withSystemPrompt(
  messages: readonly ProviderMessage[],
  parameters: ModelParameters
): ProviderMessage[] {
  if (!parameters.systemPrompt?.trim()) return [...messages]
  if (messages[0]?.role === 'system') return [...messages]
  return [{ role: 'system', content: parameters.systemPrompt }, ...messages]
}

export async function listModels(connection: ProviderConnection): Promise<string[]> {
  const response = await fetch(endpoint(connection, '/models'), {
    method: 'GET',
    headers: authHeaders(connection)
  })

  if (!response.ok) {
    throw new RuntimeError(
      'ai.http-error',
      `HTTP ${response.status}: ${await describeHttpError(response)}`
    )
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> }
  return (payload.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string')
}

export async function testConnection(connection: ProviderConnection): Promise<void> {
  const response = await fetch(endpoint(connection, '/chat/completions'), {
    method: 'POST',
    headers: authHeaders(connection),
    body: JSON.stringify({
      model: connection.modelName,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    })
  })

  if (!response.ok) {
    throw new RuntimeError(
      'ai.http-error',
      `HTTP ${response.status}: ${await describeHttpError(response)}`
    )
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

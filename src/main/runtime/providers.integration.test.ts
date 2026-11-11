import { afterEach, describe, expect, it, vi } from 'vitest'
import { localServer } from '../../../tests/helpers/http'
import { deferred } from '../../../tests/helpers/deferred'
import { listModels, streamChat, testConnection, type ProviderMessage } from './providers'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'
import type { ProviderConnection } from '@shared/domain'

let server: Awaited<ReturnType<typeof localServer>> | undefined
let fixture: KernelFixture | undefined
afterEach(async () => {
  if (fixture) {
    await fixture.dispose()
    fixture = undefined
  }
  if (server) {
    await server.close()
    server = undefined
  }
  vi.restoreAllMocks()
})
const parameters = { systemPrompt: '系统提示', temperature: 0.4, topP: 0.7 }
const connection = (): ProviderConnection => ({
  baseUrl: `${server!.url}/v1///`,
  apiKey: 'test-only',
  modelName: 'test-model'
})

describe('本地 HTTP 供应商协议', () => {
  it('完整请求保留图片、上下文和采样参数，逐字节响应还原中文与推理', async () => {
    const received = deferred<{ url?: string; auth?: string; body: Record<string, unknown> }>()
    server = await localServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => {
        body += chunk
      })
      request.on('end', () => {
        received.resolve({
          url: request.url,
          auth: request.headers.authorization,
          body: JSON.parse(body)
        })
        response.writeHead(200, { 'Content-Type': 'text/event-stream' })
        const bytes = Buffer.from(
          'data: {"choices":[{"delta":{"reasoning":"思考😀","content":"回答中文"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'
        )
        for (const byte of bytes) response.write(Buffer.from([byte]))
        response.end()
      })
    })
    const messages: ProviderMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: '看图' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }
        ]
      }
    ]
    const handlers = { onDelta: vi.fn(), onReasoning: vi.fn() }
    expect(
      await streamChat(connection(), parameters, messages, new AbortController().signal, handlers)
    ).toEqual({ content: '回答中文', reasoning: '思考😀' })
    expect(await received.promise).toEqual({
      url: '/v1/chat/completions',
      auth: 'Bearer test-only',
      body: {
        model: 'test-model',
        temperature: 0.4,
        top_p: 0.7,
        stream: true,
        messages: [{ role: 'system', content: '系统提示' }, ...messages]
      }
    })
    expect(handlers.onDelta.mock.calls.flat().join('')).toBe('回答中文')
    expect(handlers.onReasoning.mock.calls.flat().join('')).toBe('思考😀')
  })

  it.each([401, 429, 500])('HTTP %i 保留状态与供应商错误，连接测试也失败', async (status) => {
    server = await localServer((_request, response) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: { message: '测试错误' } }))
    })
    const expected = { code: 'ai.http-error', message: `HTTP ${status}: 测试错误` }
    await expect(
      streamChat(connection(), parameters, [], new AbortController().signal, {
        onDelta: vi.fn(),
        onReasoning: vi.fn()
      })
    ).rejects.toMatchObject(expected)
    await expect(testConnection(connection())).rejects.toMatchObject(expected)
    await expect(listModels(connection())).rejects.toMatchObject(expected)
  })

  it('模型目录和连接测试通过内核返回可用结果，连接失败可重试', async () => {
    let fail = true
    server = await localServer((request, response) => {
      response.setHeader('Content-Type', 'application/json')
      if (request.url === '/v1/models')
        response.end(JSON.stringify({ data: [{ id: 'a' }, { id: 'b' }, {}, { id: 1 }] }))
      else if (fail) {
        response.statusCode = 401
        response.end('{"error":{"message":"bad key"}}')
      } else response.end('{"choices":[{"message":{"content":"Hi"}}]}')
    })
    fixture = await createKernel()
    await fixture.configure(`${server.url}/v1`)
    expect(await fixture.query('ai.models', { llmId: 'llm' })).toEqual({ models: ['a', 'b'] })
    expect(await fixture.query('ai.test', { llmId: 'llm' })).toMatchObject({
      ok: false,
      message: expect.stringContaining('401')
    })
    fail = false
    expect(await fixture.query('ai.test', { llmId: 'llm' })).toMatchObject({ ok: true })
    expect(await fixture.query('ai.models', { llmId: 'missing' })).toMatchObject({
      models: [],
      error: '未找到指定的 LLM 配置'
    })
  })

  it('真实连接中断报告失败；用户取消流则及时结束并保留已收到的文本', async () => {
    const headersReceived = deferred()
    server = await localServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      response.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')
      headersReceived.resolve()
    })
    const controller = new AbortController()
    const delta = deferred()
    const request = streamChat(connection(), parameters, [], controller.signal, {
      onDelta: () => delta.resolve(),
      onReasoning: vi.fn()
    })
    await headersReceived.promise
    await delta.promise
    controller.abort()
    expect(await request).toEqual({ content: 'partial', reasoning: '' })
    const secondDelta = deferred()
    const interrupted = streamChat(connection(), parameters, [], new AbortController().signal, {
      onDelta: () => secondDelta.resolve(),
      onReasoning: vi.fn()
    })
    const failed = expect(interrupted).rejects.toThrow()
    await secondDelta.promise
    await server.close()
    server = undefined
    await failed
  })
})

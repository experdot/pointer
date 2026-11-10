import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChat } from './providers'

const connection = { baseUrl: 'http://invalid.test/v1', apiKey: 'test', modelName: 'test' }
const parameters = { systemPrompt: '', temperature: 1, topP: 1 }
afterEach(() => vi.unstubAllGlobals())

function response(chunks: Uint8Array[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(chunk)
              controller.close()
            }
          })
        )
    )
  )
}

describe('[R12] SSE 解析', () => {
  it.each([
    'data: {"error":{"message":"quota exceeded"}}\n\n',
    'event: error\ndata: upstream unavailable\n\n'
  ])('HTTP 200 的供应商错误也必须失败：%s', async (data) => {
    response([new TextEncoder().encode(data)])
    await expect(
      streamChat(connection, parameters, [], new AbortController().signal, {
        onDelta: vi.fn(),
        onReasoning: vi.fn()
      })
    ).rejects.toMatchObject({ code: 'ai.stream-error' })
  })

  it('逐字节分片保持 UTF-8；DONE 后不接收多余内容', async () => {
    const data =
      'data: {"choices":[{"delta":{"content":"汉字😀","reasoning_content":"思考"}}]}\r\n\r\ndata: [DONE]\n\ndata: {"choices":[{"delta":{"content":"extra"}}]}\n\n'
    response([...new TextEncoder().encode(data)].map((byte) => new Uint8Array([byte])))
    const delta = vi.fn(),
      reasoning = vi.fn()
    expect(
      await streamChat(connection, parameters, [], new AbortController().signal, {
        onDelta: delta,
        onReasoning: reasoning
      })
    ).toEqual({ content: '汉字😀', reasoning: '思考' })
    expect(delta.mock.calls.flat().join('')).toBe('汉字😀')
  })

  it('文件结尾没有空行也会处理最后事件', async () => {
    response([new TextEncoder().encode('data: {"choices":[{"delta":{"content":"last"}}]}')])
    expect(
      (
        await streamChat(connection, parameters, [], new AbortController().signal, {
          onDelta: vi.fn(),
          onReasoning: vi.fn()
        })
      ).content
    ).toBe('last')
  })
})

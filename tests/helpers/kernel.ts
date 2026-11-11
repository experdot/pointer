import { expect, vi, type Mock } from 'vitest'
import { RuntimeCore, type RuntimeHost } from '../../src/main/runtime/RuntimeCore'
import { defaultSettings, type Settings } from '../../src/shared/domain'
import type {
  RuntimeCommandName,
  RuntimeCommandPayload,
  RuntimeCommandResult,
  RuntimeEvent,
  RuntimeQueryName,
  RuntimeQueryPayload,
  RuntimeQueryResult
} from '../../src/shared/contracts'
import { testDirectory } from './temp'

export function runtimeHost(): RuntimeHost {
  return {
    getVersion: vi.fn(() => '2.0.0-test'),
    saveFile: vi.fn(async () => ({})),
    openTextFile: vi.fn(async () => null),
    pickDirectory: vi.fn(async () => null),
    pickImages: vi.fn(async () => []),
    openInFileManager: vi.fn(async () => undefined)
  }
}

export interface KernelFixture {
  root: string
  host: RuntimeHost
  events: RuntimeEvent[]
  readonly runtime: RuntimeCore
  command<K extends RuntimeCommandName>(
    name: K,
    payload: RuntimeCommandPayload<K>
  ): Promise<RuntimeCommandResult<K>>
  query<K extends RuntimeQueryName>(
    name: K,
    payload: RuntimeQueryPayload<K>
  ): Promise<RuntimeQueryResult<K>>
  configure(baseUrl?: string): Promise<Settings>
  restart(): Promise<void>
  terminal(requestId: string): Promise<void>
  dispose(): Promise<void>
}

export async function createKernel(): Promise<KernelFixture> {
  const directory = await testDirectory()
  const host = runtimeHost()
  let runtime = new RuntimeCore({ appDataPath: directory.path, host })
  const events: RuntimeEvent[] = []
  runtime.subscribe((event) => events.push(event))
  try {
    await runtime.init()
  } catch (error) {
    await runtime.dispose()
    await directory.remove()
    throw error
  }
  const fixture: KernelFixture = {
    root: directory.path,
    host,
    events,
    get runtime() {
      return runtime
    },
    command<K extends RuntimeCommandName>(name: K, payload: RuntimeCommandPayload<K>) {
      return runtime.command(name, payload) as Promise<RuntimeCommandResult<K>>
    },
    query<K extends RuntimeQueryName>(name: K, payload: RuntimeQueryPayload<K>) {
      return runtime.query(name, payload) as Promise<RuntimeQueryResult<K>>
    },
    async configure(baseUrl = 'http://provider.invalid/v1') {
      const settings = defaultSettings()
      settings.llmConfigs.items = [
        {
          id: 'llm',
          kind: 'item',
          name: '测试模型',
          order: 0,
          createdAt: 1,
          apiKey: 'test-only',
          baseUrl,
          modelName: 'test-model'
        }
      ]
      settings.defaultLLMId = 'llm'
      await fixture.command('settings.replace', { settings })
      return settings
    },
    async restart() {
      await runtime.dispose()
      runtime = new RuntimeCore({ appDataPath: directory.path, host })
      runtime.subscribe((event) => events.push(event))
      await runtime.init()
    },
    async terminal(requestId: string) {
      await vi.waitFor(() => {
        expect(
          events.some(
            (event) =>
              ['chat.completed', 'chat.failed', 'chat.aborted', 'chat.saveFailed'].includes(
                event.type
              ) &&
              'requestId' in event.payload &&
              event.payload.requestId === requestId
          )
        ).toBe(true)
      })
    },
    async dispose() {
      // 故障注入先撤销，再释放可能仍有待保存内容的内核。
      vi.restoreAllMocks()
      await runtime.retrySaves()
      await runtime.dispose()
      vi.unstubAllGlobals()
      await directory.remove()
    }
  }
  return fixture
}

interface ProviderRequest {
  url: string
  body: Record<string, unknown>
  options?: RequestInit
  delta: (content: string, reasoning?: string) => void
  finish: () => void
  fail: (error?: Error) => void
}

export function controlledProvider(): {
  requests: ProviderRequest[]
  fetch: Mock<(url: string | URL | Request, options?: RequestInit) => Promise<Response>>
} {
  const requests: ProviderRequest[] = []
  const fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    let closed = false
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (data: unknown): void => {
            if (!closed)
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`
                )
              )
          }
          const close = (): void => {
            if (closed) return
            closed = true
            options?.signal?.removeEventListener('abort', close)
            controller.close()
          }
          options?.signal?.addEventListener('abort', close, { once: true })
          requests.push({
            url: String(url),
            body: JSON.parse(String(options?.body ?? '{}')),
            options,
            delta: (content, reasoning_content) =>
              emit({ choices: [{ delta: { content, reasoning_content } }] }),
            finish: () => {
              emit('[DONE]')
              close()
            },
            fail: (error = new Error('测试连接中断')) => {
              if (closed) return
              closed = true
              options?.signal?.removeEventListener('abort', close)
              controller.error(error)
            }
          })
        },
        cancel() {
          closed = true
        }
      }),
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  })
  vi.stubGlobal('fetch', fetch)
  return { requests, fetch }
}

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RUNTIME_CHANNELS, type RuntimePort } from '@shared/contracts'

const ipc = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn()
}))
vi.mock('electron', () => ({ ipcRenderer: ipc, contextBridge: { exposeInMainWorld: vi.fn() } }))
let runtime: RuntimePort

beforeAll(async () => {
  const surface: { runtime?: RuntimePort } = {}
  vi.stubGlobal('window', surface)
  await import('./index')
  runtime = surface.runtime!
})
beforeEach(() => vi.clearAllMocks())
afterAll(() => vi.unstubAllGlobals())

describe('preload 契约回归', () => {
  it('[R13] 响应作用域不符时拒绝，不把旧数据交给镜像', async () => {
    ipc.invoke.mockResolvedValue({ ok: true, scopeId: 'B', value: {} })
    await expect(runtime.query('tree.get', undefined, 'A')).rejects.toMatchObject({
      code: 'runtime.stale-response'
    })
    await expect(runtime.command('queue.clear', { pageId: 'p' }, 'A')).rejects.toMatchObject({
      code: 'runtime.stale-response'
    })
    await expect(runtime.query('session.get', undefined, null)).resolves.toEqual({})
    await expect(
      runtime.command('session.selectWorkspace', { workspaceId: 'B' }, 'A')
    ).resolves.toEqual({})
  })

  it('[R7,R15] flush 成功后才确认，释放时移除监听', async () => {
    let resolve!: () => void
    const pending = new Promise<void>((done) => {
      resolve = done
    })
    const remove = runtime.onFlush!(() => pending)
    const listener = ipc.on.mock.calls[0][1]
    const response = listener({}, 'flush-1')
    expect(ipc.send).not.toHaveBeenCalled()
    resolve()
    await response
    expect(ipc.send).toHaveBeenCalledWith(RUNTIME_CHANNELS.flushed, { id: 'flush-1', ok: true })
    remove()
    expect(ipc.removeListener).toHaveBeenCalledWith(RUNTIME_CHANNELS.flush, listener)
  })

  it('[R7,R15] flush 失败回传失败原因，不能确认成功', async () => {
    runtime.onFlush!(async () => {
      throw new Error('disk full')
    })
    await ipc.on.mock.calls[0][1]({}, 'flush-2')
    expect(ipc.send).toHaveBeenCalledExactlyOnceWith(RUNTIME_CHANNELS.flushed, {
      id: 'flush-2',
      ok: false,
      message: 'disk full'
    })
  })
})

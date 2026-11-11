import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RUNTIME_CHANNELS, RuntimeError, type RuntimeEvent } from '@shared/contracts'
import type { RuntimeCore } from '../runtime/RuntimeCore'
import { setupRuntimeIpc } from './runtimeIpc'

const mocks = vi.hoisted(() => ({
  windows: vi.fn(),
  handle: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: mocks.windows },
  ipcMain: { handle: mocks.handle, on: mocks.on, removeListener: mocks.removeListener }
}))

function windowStub(destroyed = false): {
  isDestroyed: () => boolean
  webContents: EventEmitter & { send: ReturnType<typeof vi.fn> }
} {
  const webContents = Object.assign(new EventEmitter(), { send: vi.fn() })
  return { isDestroyed: () => destroyed, webContents }
}
let bus: EventEmitter
let flush: () => Promise<void>
let emit: (event: RuntimeEvent) => void
let runtime: { query: ReturnType<typeof vi.fn>; command: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.resetAllMocks()
  bus = new EventEmitter()
  mocks.on.mockImplementation((channel, listener) => bus.on(channel, listener))
  mocks.removeListener.mockImplementation((channel, listener) =>
    bus.removeListener(channel, listener)
  )
  mocks.windows.mockReturnValue([])
  runtime = { query: vi.fn(), command: vi.fn() }
  setupRuntimeIpc({
    ...runtime,
    getScopeId: () => 'scope',
    setFlushHandler: (callback: typeof flush) => {
      flush = callback
    },
    subscribe: (callback: typeof emit) => {
      emit = callback
      return () => undefined
    }
  } as unknown as RuntimeCore)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('主进程 IPC 适配', () => {
  it.each(['query', 'command'] as const)('%s 透传参数/scope并保留可序列化错误码', async (kind) => {
    const handler = mocks.handle.mock.calls.find(
      ([channel]) => channel === RUNTIME_CHANNELS[kind]
    )![1]
    runtime[kind].mockResolvedValue({ id: 'result' })
    expect(await handler({}, { name: 'sample', payload: { x: 1 }, scopeId: 'scope' })).toEqual({
      ok: true,
      scopeId: 'scope',
      value: { id: 'result' }
    })
    expect(runtime[kind]).toHaveBeenCalledWith('sample', { x: 1 }, 'scope')
    runtime[kind].mockRejectedValue(new RuntimeError('test.failure', '错误原因', { retry: true }))
    expect(await handler({}, { name: 'sample' })).toMatchObject({
      ok: false,
      code: 'test.failure',
      message: '错误原因',
      details: { retry: true }
    })
    expect(await handler({}, null)).toMatchObject({ ok: false })
  })

  it('事件只广播给仍存活的窗口', () => {
    const alive = windowStub()
    const closed = windowStub(true)
    mocks.windows.mockReturnValue([alive, closed])
    const event: RuntimeEvent = {
      type: 'queue.changed',
      scopeId: 'scope',
      payload: { pageId: 'page' }
    }
    emit(event)
    expect(alive.webContents.send).toHaveBeenCalledWith(RUNTIME_CHANNELS.event, event)
    expect(closed.webContents.send).not.toHaveBeenCalled()
  })

  it('每个窗口须确认自己的请求，错误 sender 和 id 不会提前结束握手', async () => {
    const windows = [windowStub(), windowStub()]
    mocks.windows.mockReturnValue(windows)
    const finished = vi.fn()
    const pending = flush().then(finished)
    const firstId = windows[0].webContents.send.mock.calls[0][1]
    bus.emit(
      RUNTIME_CHANNELS.flushed,
      { sender: windows[1].webContents },
      { id: firstId, ok: true }
    )
    bus.emit(
      RUNTIME_CHANNELS.flushed,
      { sender: windows[0].webContents },
      { id: 'wrong', ok: true }
    )
    await Promise.resolve()
    expect(finished).not.toHaveBeenCalled()
    for (const window of windows)
      bus.emit(
        RUNTIME_CHANNELS.flushed,
        { sender: window.webContents },
        { id: window.webContents.send.mock.calls[0][1], ok: true }
      )
    await pending
    expect(bus.listenerCount(RUNTIME_CHANNELS.flushed)).toBe(0)
    expect(windows.every((window) => window.webContents.listenerCount('destroyed') === 0)).toBe(
      true
    )
  })

  it('任意窗口保存失败就释放所有等待监听，不留下超时任务', async () => {
    vi.useFakeTimers()
    const windows = [windowStub(), windowStub()]
    mocks.windows.mockReturnValue(windows)
    const pending = flush()
    const failed = expect(pending).rejects.toThrow('保存失败')
    bus.emit(
      RUNTIME_CHANNELS.flushed,
      { sender: windows[0].webContents },
      {
        id: windows[0].webContents.send.mock.calls[0][1],
        ok: false,
        message: '保存失败'
      }
    )
    await failed
    expect(bus.listenerCount(RUNTIME_CHANNELS.flushed)).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['timeout', 'destroyed', 'send-error'] as const)(
    '%s 拒绝握手并释放资源',
    async (mode) => {
      vi.useFakeTimers()
      const window = windowStub()
      if (mode === 'send-error')
        window.webContents.send.mockImplementation(() => {
          throw new Error('send failed')
        })
      mocks.windows.mockReturnValue([window])
      const pending = flush()
      const failed = expect(pending).rejects.toThrow()
      if (mode === 'timeout') await vi.advanceTimersByTimeAsync(15000)
      if (mode === 'destroyed') window.webContents.emit('destroyed')
      await failed
      expect(bus.listenerCount(RUNTIME_CHANNELS.flushed)).toBe(0)
      expect(window.webContents.listenerCount('destroyed')).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    }
  )
})

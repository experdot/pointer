import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupAutoUpdater } from './autoUpdater'
import { deferred } from '../../tests/helpers/deferred'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (payload: never) => void>(),
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn()
}))
vi.mock('electron', () => ({ app: { getVersion: () => '2.0.0' } }))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: (name: string, handler: (payload: never) => void) => mocks.handlers.set(name, handler),
    checkForUpdates: mocks.check,
    downloadUpdate: mocks.download,
    quitAndInstall: mocks.install
  }
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.handlers.clear()
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('自动更新适配器', () => {
  it.each(['1.9.9', '2.0.0', '2.1.0-beta.1'])('远端 %s 根据版本语义返回状态', async (version) => {
    mocks.check.mockResolvedValue({ updateInfo: { version } })
    const report = vi.fn()
    const updater = setupAutoUpdater(report)
    const available = version === '2.1.0-beta.1'
    expect(await updater.check()).toEqual({ available, version })
    expect(report.mock.calls[0]).toEqual([{ state: 'checking' }])
    expect(report).toHaveBeenLastCalledWith(
      available ? { state: 'available', version } : { state: 'idle' }
    )
  })

  it('检查失败报告错误，下一次检查可以恢复', async () => {
    mocks.check
      .mockRejectedValueOnce(new Error('离线'))
      .mockResolvedValueOnce({ updateInfo: { version: '2.1.0' } })
    const report = vi.fn()
    const updater = setupAutoUpdater(report)
    expect(await updater.check()).toEqual({ available: false })
    expect(report).toHaveBeenLastCalledWith({ state: 'error', message: '离线' })
    expect(await updater.check()).toEqual({ available: true, version: '2.1.0' })
  })

  it('并发检查只请求一次；下载失败报告状态且可以重试', async () => {
    const result = deferred<{ updateInfo: { version: string } }>()
    mocks.check.mockReturnValue(result.promise)
    const report = vi.fn()
    const updater = setupAutoUpdater(report)
    const first = updater.check()
    const second = updater.check()
    expect(mocks.check).toHaveBeenCalledTimes(1)
    result.resolve({ updateInfo: { version: '2.1.0' } })
    expect(await first).toEqual(await second)
    mocks.download.mockRejectedValueOnce(new Error('下载失败')).mockResolvedValueOnce(undefined)
    await expect(updater.download()).rejects.toThrow('下载失败')
    expect(report).toHaveBeenLastCalledWith({ state: 'error', message: '下载失败' })
    await updater.download()
    expect(mocks.download).toHaveBeenCalledTimes(2)
  })

  it('下载事件和安装透传，旧版本可用事件被过滤', () => {
    const report = vi.fn()
    const updater = setupAutoUpdater(report)
    mocks.handlers.get('update-available')!({ version: '1.0.0' } as never)
    expect(report).toHaveBeenLastCalledWith({ state: 'idle' })
    mocks.handlers.get('download-progress')!({ percent: 42 } as never)
    expect(report).toHaveBeenLastCalledWith({ state: 'downloading', percent: 42 })
    mocks.handlers.get('update-downloaded')!({ version: '2.1.0' } as never)
    expect(report).toHaveBeenLastCalledWith({ state: 'downloaded', version: '2.1.0' })
    updater.quitAndInstall()
    expect(mocks.install).toHaveBeenCalledOnce()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ready: vi.fn(),
  exit: vi.fn(),
  dialog: vi.fn(),
  createWindow: vi.fn(),
  createRuntime: vi.fn(),
  setupRuntimeIpc: vi.fn(),
  runtime: {
    init: vi.fn(),
    dispose: vi.fn(),
    setUpdater: vi.fn()
  }
}))

vi.mock('electron', () => ({
  app: {
    whenReady: mocks.ready,
    getPath: () => 'test-data',
    on: vi.fn(),
    exit: mocks.exit
  },
  BrowserWindow: {},
  dialog: { showErrorBox: mocks.dialog }
}))
vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() }
}))
vi.mock('./autoUpdater', () => ({ setupAutoUpdater: vi.fn() }))
vi.mock('./ipc/windowIpc', () => ({ setupWindowIpc: vi.fn() }))
vi.mock('./ipc/runtimeIpc', () => ({ setupRuntimeIpc: mocks.setupRuntimeIpc }))
vi.mock('./runtimeHost', () => ({ createRuntimeHost: vi.fn() }))
vi.mock('./window', () => ({ createWindow: mocks.createWindow }))
vi.mock('./runtime', () => ({
  RuntimeCore: vi.fn(function (options: unknown) {
    mocks.createRuntime(options)
    return mocks.runtime
  })
}))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.ready.mockResolvedValue(undefined)
  mocks.runtime.init.mockResolvedValue(undefined)
  mocks.runtime.dispose.mockResolvedValue(undefined)
})

afterEach(() => vi.restoreAllMocks())

describe('主进程启动', () => {
  it('内核就绪后才创建窗口', async () => {
    await import('./index')
    await vi.waitFor(() => expect(mocks.createWindow).toHaveBeenCalledOnce())
    expect(mocks.createRuntime).toHaveBeenCalledWith({ appDataPath: 'test-data', host: undefined })
    expect(mocks.setupRuntimeIpc).toHaveBeenCalledWith(mocks.runtime)
    expect(mocks.runtime.init.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createWindow.mock.invocationCallOrder[0]
    )
    expect(mocks.dialog).not.toHaveBeenCalled()
    expect(mocks.exit).not.toHaveBeenCalled()
  })

  it.each(['settings.invalid-order-key', 'tree.invalid-order-key', 'page.parse-failed'])(
    '拒绝旧数据 %s 时提示原因、释放资源并退出',
    async (code) => {
      const { RuntimeError } = await import('@shared/contracts')
      mocks.runtime.init.mockRejectedValue(new RuntimeError(code, '数据格式无效'))
      await import('./index')
      await vi.waitFor(() => expect(mocks.exit).toHaveBeenCalledWith(1))
      expect(mocks.runtime.dispose).toHaveBeenCalledOnce()
      expect(mocks.dialog).toHaveBeenCalledWith(
        'Pointer 启动失败',
        expect.stringContaining('数据格式无效\n\n数据目录：test-data')
      )
      expect(mocks.dialog.mock.calls[0][1]).toContain('不支持旧版数字排序数据')
      expect(mocks.createWindow).not.toHaveBeenCalled()
    }
  )

  it('初始化前失败也会提示并退出，不依赖内核已创建', async () => {
    mocks.ready.mockRejectedValue(new Error('Electron 初始化失败'))
    await import('./index')
    await vi.waitFor(() => expect(mocks.exit).toHaveBeenCalledWith(1))
    expect(mocks.createRuntime).not.toHaveBeenCalled()
    expect(mocks.runtime.dispose).not.toHaveBeenCalled()
    expect(mocks.dialog).toHaveBeenCalledWith(
      'Pointer 启动失败',
      expect.stringContaining('Electron 初始化失败')
    )
    expect(mocks.createWindow).not.toHaveBeenCalled()
  })

  it('释放资源和错误对话框均失败时仍退出，不留下未处理拒绝', async () => {
    mocks.runtime.init.mockRejectedValue(new Error('数据无法读取'))
    mocks.runtime.dispose.mockRejectedValue(new Error('释放失败'))
    mocks.dialog.mockImplementation(() => {
      throw new Error('对话框失败')
    })
    await import('./index')
    await vi.waitFor(() => expect(mocks.exit).toHaveBeenCalledWith(1))
    expect(mocks.runtime.dispose).toHaveBeenCalledOnce()
    expect(mocks.dialog).toHaveBeenCalledOnce()
    expect(mocks.createWindow).not.toHaveBeenCalled()
  })
})

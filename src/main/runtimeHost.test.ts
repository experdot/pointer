import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { testDirectory } from '../../tests/helpers/temp'
import { createRuntimeHost } from './runtimeHost'

const mocks = vi.hoisted(() => ({ save: vi.fn(), open: vi.fn(), openPath: vi.fn() }))
vi.mock('electron', () => ({
  app: { getVersion: () => '2.0.0' },
  dialog: { showSaveDialog: mocks.save, showOpenDialog: mocks.open },
  shell: { openPath: mocks.openPath }
}))
let directory: Awaited<ReturnType<typeof testDirectory>>
beforeEach(async () => {
  vi.resetAllMocks()
  directory = await testDirectory()
})
afterEach(async () => {
  await directory.remove()
})

describe('文件对话框与系统集成', () => {
  it('取消各种对话框没有文件写入或伪造成功结果', async () => {
    mocks.save.mockResolvedValue({ canceled: true })
    mocks.open.mockResolvedValue({ canceled: true, filePaths: [] })
    const host = createRuntimeHost()
    expect(await host.saveFile({ suggestedName: 'test.txt', content: '内容' })).toEqual({})
    expect(await host.openTextFile()).toBeNull()
    expect(await host.pickImages({})).toEqual([])
    expect(await host.pickDirectory()).toBeNull()
  })

  it('UTF-8 文本保存和打开往返保持中文、emoji 与换行', async () => {
    const file = join(directory.path, '中文.txt')
    mocks.save.mockResolvedValue({ canceled: false, filePath: file })
    mocks.open.mockResolvedValue({ canceled: false, filePaths: [file] })
    const host = createRuntimeHost()
    const content = '中文😀\n第二行\r\n'
    expect(await host.saveFile({ suggestedName: '中文.txt', content })).toEqual({ savedPath: file })
    expect(await host.openTextFile()).toEqual({ name: '中文.txt', content })
  })

  it('二进制保存不改变字节；图片选择返回正确 MIME、大小和内容', async () => {
    const file = join(directory.path, 'image.PNG')
    const bytes = Buffer.from([0, 137, 80, 255, 10, 13])
    mocks.save.mockResolvedValue({ canceled: false, filePath: file })
    const host = createRuntimeHost()
    await host.saveFile({
      suggestedName: 'image.PNG',
      content: bytes.toString('base64'),
      encoding: 'base64'
    })
    expect(await readFile(file)).toEqual(bytes)
    mocks.open.mockResolvedValue({ canceled: false, filePaths: [file] })
    expect(await host.pickImages({ multiple: false })).toEqual([
      {
        name: 'image.PNG',
        mimeType: 'image/png',
        size: bytes.length,
        dataBase64: bytes.toString('base64')
      }
    ])
    expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ properties: ['openFile'] }))
  })

  it('保存失败向调用方返回错误，打开工作区使用目录本身', async () => {
    const file = join(directory.path, 'not-a-folder')
    await writeFile(file, '')
    mocks.save.mockResolvedValue({ canceled: false, filePath: join(file, 'child') })
    const host = createRuntimeHost()
    await expect(host.saveFile({ suggestedName: 'child', content: '' })).rejects.toThrow()
    mocks.openPath.mockResolvedValue('')
    await host.openInFileManager(directory.path)
    expect(mocks.openPath).toHaveBeenCalledWith(directory.path)
    mocks.openPath.mockResolvedValue('无法打开目录')
    await expect(host.openInFileManager(directory.path)).rejects.toThrow('无法打开目录')
  })
})

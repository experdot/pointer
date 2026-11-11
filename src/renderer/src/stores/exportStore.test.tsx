import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExportStore, useExportStore } from './exportStore'
import { ExportEditor } from '../components/editors/ExportEditor'
import { exportManager } from '../features/export/ExportManager'
import type { ConvertResult } from '../features/export/types'
import { deferred } from '../../../../tests/helpers/deferred'
import { command } from '../runtime/client'
import { copyToClipboard } from '../utils/clipboard'
import { screenshotElement, downloadBlob, copyImageToClipboard } from '../utils/screenshot'

vi.mock('../features/export/ExportManager', () => ({
  exportManager: {
    generatePreview: vi.fn(),
    getFormat: vi.fn(() => ({ name: 'Text', extension: 'txt', mimeType: 'text/plain' }))
  }
}))
vi.mock('../runtime/client', () => ({ command: vi.fn() }))
vi.mock('../utils/clipboard', () => ({ copyToClipboard: vi.fn() }))
vi.mock('../utils/screenshot', () => ({
  screenshotElement: vi.fn(),
  downloadBlob: vi.fn(),
  copyImageToClipboard: vi.fn()
}))
vi.mock('../components/editors/ExportEditor/panels/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('../components/editors/ExportEditor/panels/PreviewPanel', () => ({
  PreviewPanel: function Probe() {
    const state = useExportStore()
    return (
      <input
        aria-label="预览编辑"
        value={String(state.editedContent ?? state.previewResult?.content ?? '')}
        onChange={(event) => state.setEditedContent(event.target.value)}
      />
    )
  }
}))
const result = (content: string): ConvertResult => ({
  content,
  isBinary: false,
  extension: 'txt',
  mimeType: 'text/plain'
})
function store(): ReturnType<typeof createExportStore> {
  const instance = createExportStore()
  instance.getState().setSourceType('text-snippet')
  instance.getState().setSourceData({ type: 'text-snippet', text: 'original' })
  return instance
}
beforeEach(() => {
  vi.mocked(exportManager.generatePreview).mockReset().mockResolvedValue(result('preview'))
  vi.mocked(command).mockReset().mockResolvedValue({})
  vi.mocked(copyToClipboard).mockReset().mockResolvedValue(true)
  vi.mocked(screenshotElement)
    .mockReset()
    .mockResolvedValue(new Blob(['png']))
  vi.mocked(downloadBlob).mockReset()
  vi.mocked(copyImageToClipboard).mockReset().mockResolvedValue(undefined)
})

describe('导出编辑器状态与实际出口', () => {
  it('两个真实挂载的编辑器互不重置、互不覆盖编辑内容', async () => {
    vi.mocked(exportManager.generatePreview).mockImplementation(async (_type, data) =>
      result(data.type === 'text-snippet' ? data.text : '')
    )
    const a = { sourceType: 'text-snippet' as const, text: 'first' }
    const b = { sourceType: 'text-snippet' as const, text: 'second' }
    const view = render(
      <>
        <ExportEditor context={a} />
        <ExportEditor context={b} />
      </>
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('textbox').map((element) => (element as HTMLInputElement).value)
      ).toEqual(['first', 'second'])
    )
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'edited first' } })
    expect((screen.getAllByRole('textbox')[1] as HTMLInputElement).value).toBe('second')
    view.rerender(
      <>
        <ExportEditor context={a} />
        <ExportEditor context={{ ...b, text: 'third' }} />
      </>
    )
    await waitFor(() =>
      expect((screen.getAllByRole('textbox')[1] as HTMLInputElement).value).toBe('third')
    )
    expect((screen.getAllByRole('textbox')[0] as HTMLInputElement).value).toBe('edited first')
  })

  it('预览乱序、输入修改、手动编辑和重置不会被旧请求覆盖', async () => {
    const instance = store()
    const old = deferred<ConvertResult>()
    vi.mocked(exportManager.generatePreview)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(result('new'))
    const pending = instance.getState().generatePreview()
    instance.getState().setSourceData({ type: 'text-snippet', text: 'new' })
    await instance.getState().generatePreview()
    old.resolve(result('old'))
    await pending
    expect(instance.getState().previewResult?.content).toBe('new')
    for (const change of [
      () => instance.getState().setEditedContent('manual'),
      () => instance.getState().reset()
    ]) {
      const late = deferred<ConvertResult>()
      vi.mocked(exportManager.generatePreview).mockReturnValueOnce(late.promise)
      const generation = instance.getState().generatePreview()
      change()
      late.resolve(result('late'))
      await generation
      expect(instance.getState().previewResult?.content).not.toBe('late')
      expect(instance.getState().isGenerating).toBe(false)
    }
  })

  it('保存和复制使用编辑后的字面文本，包括空文本；失败明确拒绝且允许重试', async () => {
    const instance = store()
    await instance.getState().generatePreview()
    instance.getState().setEditedContent('edited\n\t$1')
    vi.mocked(command).mockRejectedValueOnce(new Error('磁盘不可写')).mockResolvedValue({})
    await expect(instance.getState().doExport()).rejects.toThrow('磁盘不可写')
    await instance.getState().doExport()
    expect(command).toHaveBeenLastCalledWith(
      'dialog.saveFile',
      expect.objectContaining({
        content: 'edited\n\t$1',
        filters: [{ name: 'Text', extensions: ['txt'] }]
      })
    )
    vi.mocked(copyToClipboard).mockResolvedValueOnce(false)
    await expect(instance.getState().copyToClipboard()).rejects.toThrow('复制失败')
    instance.getState().setEditedContent('')
    await instance.getState().copyToClipboard()
    expect(copyToClipboard).toHaveBeenLastCalledWith('')
    expect(instance.getState().error).toBeNull()
  })

  it('截图只使用当前编辑器容器，并传播捕获/剪贴板错误', async () => {
    const first = store()
    const second = store()
    const a = document.createElement('div')
    const b = document.createElement('div')
    first.getState().setPreviewContainerElement(a)
    second.getState().setPreviewContainerElement(b)
    await first.getState().downloadImage()
    expect(screenshotElement).toHaveBeenLastCalledWith(a)
    await second.getState().copyImageToClipboard()
    expect(screenshotElement).toHaveBeenLastCalledWith(b)
    vi.mocked(screenshotElement).mockRejectedValueOnce(new Error('截图失败'))
    await expect(first.getState().downloadImage()).rejects.toThrow('截图失败')
    vi.mocked(copyImageToClipboard).mockRejectedValueOnce(new Error('剪贴板拒绝'))
    await expect(second.getState().copyImageToClipboard()).rejects.toThrow('剪贴板拒绝')
    first.getState().setPreviewContainerElement(null)
    await expect(first.getState().downloadImage()).rejects.toThrow('请先生成预览')
  })
})

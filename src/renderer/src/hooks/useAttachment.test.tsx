import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useAttachment,
  getAttachmentDataUrl,
  importAttachmentsFromFiles,
  selectAndSaveAttachments
} from './useAttachment'
import { useChatUIStore } from '../stores/chatUIStore'
import { command, query } from '../runtime/client'
import type { AttachmentRef } from '@shared/domain'

vi.mock('../runtime/client', () => ({ command: vi.fn(), query: vi.fn() }))
const ref: AttachmentRef = {
  id: 'a',
  name: 'a.png',
  mimeType: 'image/png',
  size: 1,
  relativePath: '.pointer/attachments/a.png',
  createdAt: 1
}
beforeEach(() => {
  useChatUIStore.getState().reset()
  vi.mocked(command).mockReset()
  vi.mocked(query).mockReset()
})

describe('附件入口和草稿引用', () => {
  it('拖放/粘贴文件经过类型大小筛选并保留字节内容', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(command).mockResolvedValue([ref])
    const large = new File(['x'], 'large.png', { type: 'image/png' })
    Object.defineProperty(large, 'size', { value: 10 * 1024 * 1024 + 1 })
    const view = renderHook(() => useAttachment('p'))
    await act(() =>
      view.result.current.addAttachments([
        new File(['abc'], 'a.png', { type: 'image/png' }),
        new File(['no'], 'a.svg', { type: 'image/svg+xml' }),
        large
      ])
    )
    expect(command).toHaveBeenCalledWith('attachment.import', {
      pageId: 'p',
      files: [{ name: 'a.png', mimeType: 'image/png', dataBase64: 'YWJj' }]
    })
    expect(view.result.current.pendingAttachments).toEqual([ref])
    expect(await importAttachmentsFromFiles('p', [])).toEqual([])
  })

  it('选择器取消不导入，失败可重试且不产生重复引用', async () => {
    vi.mocked(command).mockResolvedValueOnce([])
    expect(await selectAndSaveAttachments('p')).toEqual([])
    const view = renderHook(() => useAttachment('p'))
    const picked = [{ name: 'a.png', mimeType: 'image/png', size: 1, dataBase64: 'YQ==' }]
    vi.mocked(command).mockResolvedValueOnce(picked).mockRejectedValueOnce(new Error('不可写'))
    await act(async () => {
      await expect(view.result.current.addAttachmentsFromSelector()).rejects.toThrow('不可写')
    })
    expect(view.result.current.pendingAttachments).toEqual([])
    vi.mocked(command).mockResolvedValueOnce(picked).mockResolvedValueOnce([ref])
    await act(() => view.result.current.addAttachmentsFromSelector())
    expect(view.result.current.pendingAttachments).toEqual([ref])
  })

  it('删除失败保留引用，成功后移除；发送清理不删除已发送的文件', async () => {
    useChatUIStore.getState().addPendingAttachment('p', ref)
    const view = renderHook(() => useAttachment('p'))
    vi.mocked(command).mockRejectedValueOnce(new Error('文件占用')).mockResolvedValue(undefined)
    await act(async () => {
      await expect(view.result.current.removeAttachment(ref.id)).rejects.toThrow('文件占用')
    })
    expect(view.result.current.pendingAttachments).toEqual([ref])
    await act(() => view.result.current.removeAttachment(ref.id))
    expect(view.result.current.pendingAttachments).toEqual([])
    act(() => useChatUIStore.getState().addPendingAttachment('p', ref))
    const count = vi.mocked(command).mock.calls.length
    await act(async () => {
      expect(await view.result.current.moveAttachmentsToMessage([ref])).toEqual([ref])
      view.result.current.clearAttachments()
    })
    expect(command).toHaveBeenCalledTimes(count)
    expect(view.result.current.pendingAttachments).toEqual([])
    vi.mocked(query).mockResolvedValue({ mimeType: 'image/png', dataBase64: 'YQ==' })
    expect(await getAttachmentDataUrl(ref)).toBe('data:image/png;base64,YQ==')
  })
})

import { act, fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { InputArea } from './InputArea'
import { useChatUIStore } from '../../../stores/chatUIStore'
import { deferred } from '../../../../../../tests/helpers/deferred'
import type { AttachmentRef } from '@shared/domain'

vi.mock('./ModelSelector', () => ({ ModelSelector: () => null }))
vi.mock('./ModelConfigSelector', () => ({ ModelConfigSelector: () => null }))
vi.mock('./QueueButton', () => ({ QueueButton: () => null }))
vi.mock('./AttachmentPreview', () => ({ AttachmentPreview: () => null }))

const attachment: AttachmentRef = {
  id: 'image',
  name: '截图.png',
  mimeType: 'image/png',
  size: 1,
  relativePath: '.pointer/attachments/image.png',
  createdAt: 1
}
const state = (): { inputContent: string; pendingAttachments: AttachmentRef[] } =>
  useChatUIStore.getState().getState('page')
function input(props: Partial<ComponentProps<typeof InputArea>> = {}): RenderResult {
  return render(
    <InputArea
      pageId="page"
      onSend={vi.fn()}
      onStop={vi.fn()}
      isStreaming={false}
      hasLLMConfig
      hasDefaultLLM
      queueCount={0}
      isPaused={false}
      onQueueButtonClick={vi.fn()}
      onResumeQueue={vi.fn()}
      {...props}
    />
  )
}
beforeEach(() => useChatUIStore.getState().reset())

describe('聊天输入区', () => {
  it('发送失败保留草稿和附件并显示可见错误', async () => {
    const pending = deferred()
    const onSend = vi.fn(() => pending.promise)
    useChatUIStore.getState().setInputContent('page', '不能丢失')
    useChatUIStore.getState().addPendingAttachment('page', attachment)
    input({ onSend })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await act(async () => pending.reject(new Error('磁盘不可写')))
    expect(state().inputContent).toBe('不能丢失')
    expect(state().pendingAttachments).toEqual([attachment])
    expect(screen.getByRole('alert').textContent).toContain('磁盘不可写')
  })

  it('等待接收期间连续回车只发送一次，成功后保留后来输入和新增附件', async () => {
    const pending = deferred()
    const onSend = vi.fn(() => pending.promise)
    useChatUIStore.getState().setInputContent('page', '第一次')
    useChatUIStore.getState().addPendingAttachment('page', attachment)
    input({ onSend })
    const textbox = screen.getByRole('textbox')
    fireEvent.keyDown(textbox, { key: 'Enter' })
    fireEvent.change(textbox, { target: { value: '第二次' } })
    fireEvent.keyDown(textbox, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
    act(() => useChatUIStore.getState().addPendingAttachment('page', { ...attachment, id: 'next' }))
    await act(async () => pending.resolve())
    expect(state().inputContent).toBe('第二次')
    expect(state().pendingAttachments.map((item) => item.id)).toEqual(['next'])
  })

  it('成功接收后清空已发送草稿并允许下一次发送', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    input({ onSend })
    const textbox = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textbox, { target: { value: '  hello  ' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(textbox.value).toBe(''))
    expect(onSend).toHaveBeenCalledWith('hello', undefined)
    expect(document.activeElement).toBe(textbox)
  })

  it('中文组词回车和 Shift+Enter 不发送消息', () => {
    const onSend = vi.fn()
    useChatUIStore.getState().setInputContent('page', '中文')
    input({ onSend })
    const textbox = screen.getByRole('textbox')
    fireEvent.compositionStart(textbox)
    fireEvent.keyDown(textbox, { key: 'Enter', isComposing: true })
    fireEvent.compositionEnd(textbox)
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('生成中带附件的草稿不进入文字队列，保留内容并提示', async () => {
    const onSend = vi.fn()
    useChatUIStore.getState().setInputContent('page', '说明')
    useChatUIStore.getState().addPendingAttachment('page', attachment)
    input({ onSend, isStreaming: true })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
    expect(state().pendingAttachments).toEqual([attachment])
    expect(screen.getByRole('alert').textContent).toContain('附件')
  })
})

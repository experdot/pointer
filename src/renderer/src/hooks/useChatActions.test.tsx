import { act, renderHook } from '@testing-library/react'
import { App } from 'antd'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStreaming } from './useChatStreaming'
import { useMessageQueue } from './useMessageQueue'
import { useMessageQueueStore } from '../stores/messageQueueStore'
import { usePagesStore } from '../stores/pagesStore'
import { command, query } from '../runtime/client'
import type { AttachmentRef } from '@shared/domain'

vi.mock('../runtime/client', () => ({
  command: vi.fn(),
  query: vi.fn(),
  errorMessage: (error: Error) => error.message
}))
vi.mock('../services/pagesService', () => ({ updatePage: vi.fn() }))
const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => <App>{children}</App>
const attachment: AttachmentRef = {
  id: 'a',
  name: 'a.png',
  mimeType: 'image/png',
  size: 1,
  relativePath: '.pointer/attachments/a.png',
  createdAt: 1
}
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  usePagesStore.getState().reset()
  useMessageQueueStore.getState().reset()
  vi.mocked(command).mockReset().mockResolvedValue(undefined)
  vi.mocked(query).mockReset().mockResolvedValue({ pageId: 'p', items: [], paused: false })
})
describe('发送 Hook 与队列入口', () => {
  it('分支发送保留附件和模型参数，失败拒绝上抛以保护草稿，重试不另开分支', async () => {
    const view = renderHook(
      () => useChatStreaming({ pageId: 'p', record: undefined, messages: [] }),
      { wrapper }
    )
    vi.mocked(command).mockRejectedValueOnce(new Error('磁盘满'))
    await act(async () => {
      await expect(
        view.result.current.sendMessage('text', {
          createBranch: true,
          parentId: null,
          attachments: [attachment],
          llmId: 'llm'
        })
      ).rejects.toThrow('磁盘满')
    })
    expect(command).toHaveBeenLastCalledWith(
      'chat.send',
      expect.objectContaining({
        pageId: 'p',
        parentMessageId: null,
        attachments: [attachment],
        llmId: 'llm'
      })
    )
    await act(() => view.result.current.retryMessage('m', 'another', 'params'))
    expect(command).toHaveBeenLastCalledWith('chat.regenerate', {
      pageId: 'p',
      messageId: 'm',
      llmId: 'another',
      modelConfigId: 'params'
    })
    await act(() => view.result.current.continueMessage('m'))
    expect(command).toHaveBeenLastCalledWith('chat.continue', { pageId: 'p', messageId: 'm' })
    await act(() => view.result.current.stopStreaming())
    expect(command).toHaveBeenLastCalledWith('chat.stop', { pageId: 'p' })
  })
  it('忙时仅文字入队，附件明确拒绝；空闲直接发送，暂停和恢复等待内核', async () => {
    const send = vi.fn(async () => undefined)
    const view = renderHook(
      ({ streaming }) =>
        useMessageQueue({ pageId: 'p', isStreaming: streaming, onSendMessage: send }),
      { initialProps: { streaming: true } }
    )
    await act(() => view.result.current.handleSend('queued'))
    expect(command).toHaveBeenLastCalledWith('queue.add', { pageId: 'p', content: 'queued' })
    await expect(view.result.current.handleSend('image', [attachment])).rejects.toThrow(
      '暂不支持附件'
    )
    expect(send).not.toHaveBeenCalled()
    view.rerender({ streaming: false })
    await act(() => view.result.current.handleSend('now', [attachment]))
    expect(send).toHaveBeenCalledWith('now', { attachments: [attachment] })
    await act(() => view.result.current.handleStop())
    expect(command).toHaveBeenLastCalledWith('queue.setPaused', { pageId: 'p', paused: true })
    vi.mocked(command).mockRejectedValueOnce(new Error('恢复失败'))
    await expect(view.result.current.resumeQueue()).rejects.toThrow('恢复失败')
  })
})

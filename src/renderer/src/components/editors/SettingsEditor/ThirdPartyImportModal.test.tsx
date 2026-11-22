import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rendererI18n } from '@renderer/i18n'
import { ThirdPartyImportModal } from './ThirdPartyImportModal'
import { command, prepareDeepSeekIndex } from '../../../runtime/client'

vi.mock('../../../runtime/client', () => ({ command: vi.fn(), prepareDeepSeekIndex: vi.fn() }))
beforeEach(() => {
  const computed = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => computed(element))
  vi.mocked(command).mockReset().mockResolvedValue({ importedPages: 1, importedMessages: 1 })
  vi.mocked(prepareDeepSeekIndex).mockReset()
})
async function upload(content: string, name = 'export.json'): Promise<File> {
  const file = new File([content], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: async () => content })
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } })
  return file
}
const data = {
  type: 'chats-only',
  pages: [1, 2].map((index) => ({
    id: `p${index}`,
    title: `对话${index}`,
    createdAt: Date.now(),
    messages: [{ id: `m${index}`, role: 'user', content: `内容${index}`, timestamp: Date.now() }]
  }))
}
describe('导入预览与勾选界面', () => {
  it('预览不写盘，筛选和勾选后只提交选中的标识并展示实际完成数', async () => {
    render(
      <App>
        <ThirdPartyImportModal open onClose={vi.fn()} />
      </App>
    )
    await upload(JSON.stringify(data))
    await screen.findByText('对话1')
    expect(command).not.toHaveBeenCalled()
    const secondRow = screen.getByText('对话2').closest('tr')!
    fireEvent.click(within(secondRow).getByRole('checkbox'))
    fireEvent.change(screen.getByPlaceholderText('搜索标题...'), { target: { value: '对话1' } })
    expect(screen.queryByText('对话2')).toBeNull()
    fireEvent.click(screen.getByText('导入 1 个对话', { selector: 'button span' }))
    await screen.findByText('成功: 1 个')
    expect(command).toHaveBeenCalledWith(
      'library.import',
      expect.objectContaining({ source: 'pointer', ids: ['p1'] })
    )
  })
  it('损坏文件停留在上传步骤，导入失败显示文件错误且不自动重试', async () => {
    render(
      <App>
        <ThirdPartyImportModal open onClose={vi.fn()} />
      </App>
    )
    await upload('{')
    await screen.findByText('文件解析失败，请确保是有效的 JSON 文件')
    expect(command).not.toHaveBeenCalled()
    await upload(JSON.stringify(data))
    await screen.findByText('对话1')
    vi.mocked(command).mockRejectedValueOnce(new Error('无法写入工作区'))
    fireEvent.click(screen.getByText('导入 2 个对话', { selector: 'button span' }))
    await waitFor(() => expect(screen.getByText(/import.json：无法写入工作区/)).toBeTruthy())
    expect(screen.getByText('成功: 0 个')).toBeTruthy()
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('用同一个上传区打开索引，导入失败时保留勾选并允许重试', async () => {
    render(
      <App>
        <ThirdPartyImportModal open onClose={vi.fn()} />
      </App>
    )
    vi.mocked(prepareDeepSeekIndex).mockResolvedValueOnce({
      draftId: 'draft',
      sessions: [
        { id: 's1', title: '新版一', createdAt: 1700000000000, messageCount: 5 },
        { id: 's2', title: '新版二', createdAt: 1700000000000, messageCount: 7 }
      ]
    })
    const index = await upload('[]', 'chat_session_index.json')
    expect(prepareDeepSeekIndex).toHaveBeenCalledExactlyOnceWith(index)
    const first = (await screen.findByText('新版一')).closest('tr')!
    expect(within(first).getByText('5')).toBeTruthy()
    const second = screen.getByText('新版二').closest('tr')!
    fireEvent.click(within(second).getByRole('checkbox'))
    expect(command).not.toHaveBeenCalled()

    vi.mocked(command).mockRejectedValueOnce(new Error('chat_sessions/s1.json：找不到文件'))
    fireEvent.click(screen.getByRole('button', { name: '导入 1 个对话' }))
    await screen.findByText('chat_sessions/s1.json：找不到文件')
    expect(within(screen.getByText('新版二').closest('tr')!).getByRole('checkbox')).toHaveProperty(
      'checked',
      false
    )
    fireEvent.click(screen.getByRole('button', { name: '导入 1 个对话' }))
    await screen.findByText('成功: 1 个')
    expect(vi.mocked(command).mock.calls).toEqual([
      ['library.importDeepSeekIndex', { draftId: 'draft', ids: ['s1'] }],
      ['library.importDeepSeekIndex', { draftId: 'draft', ids: ['s1'] }]
    ])
  })

  it('独立会话按内容识别，预览只显示一项并走单文件导入', async () => {
    render(
      <App>
        <ThirdPartyImportModal open onClose={vi.fn()} />
      </App>
    )
    const payload = JSON.stringify({
      id: 'standalone',
      title: '单条新版会话',
      current_message_id: 1,
      messages: [{ id: 1, parent_id: null, role: 'USER', fragments: [] }]
    })
    await upload(payload, 'renamed-session.json')
    await screen.findByText('单条新版会话')
    expect(screen.getByText('共 1 个对话')).toBeTruthy()
    expect(prepareDeepSeekIndex).not.toHaveBeenCalled()
    expect(command).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '导入 1 个对话' }))
    await screen.findByText('成功: 1 个')
    expect(command).toHaveBeenCalledExactlyOnceWith('library.import', {
      source: 'deepseek',
      payload,
      folderName: undefined,
      ids: ['standalone']
    })
  })

  it('英文说明位于点击或拖拽区，索引文件名以行内代码显示', async () => {
    await rendererI18n.changeLanguage('en-US')
    const { unmount } = render(
      <App>
        <ThirdPartyImportModal open onClose={vi.fn()} />
      </App>
    )
    try {
      const hint = screen
        .getByText('Click or drag a file here')
        .parentElement!.querySelector('.ant-upload-hint')
      expect(hint?.textContent?.trim()).toBe(
        'Supports .json export files. For DeepSeek, choose chat_session_index.json or an individual conversation JSON.'
      )
      expect(hint?.querySelector('code')?.textContent).toBe('chat_session_index.json')
      expect(screen.queryByRole('button', { name: 'Select DeepSeek session index' })).toBeNull()
    } finally {
      unmount()
      await rendererI18n.changeLanguage('zh-CN')
    }
  })
})

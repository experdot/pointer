import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from 'antd'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rendererI18n } from '@renderer/i18n'
import { ThirdPartyImportModal } from './ThirdPartyImportModal'
import { command, prepareDeepSeekIndex } from '../../../runtime/client'
import { useFoldersStore } from '../../../stores/foldersStore'

vi.mock('../../../runtime/client', () => ({ command: vi.fn(), prepareDeepSeekIndex: vi.fn() }))
beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 22, 12))
  const computed = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => computed(element))
  vi.mocked(command).mockReset().mockResolvedValue({ importedPages: 1, importedMessages: 1 })
  vi.mocked(prepareDeepSeekIndex).mockReset()
  useFoldersStore.getState().reset()
})
afterEach(() => vi.useRealTimers())
function renderImportModal(): {
  dialog: HTMLElement
  view: ReturnType<typeof within>
  unmount: () => void
} {
  const { unmount } = render(
    <App>
      <ThirdPartyImportModal open onClose={vi.fn()} />
    </App>
  )
  const dialog = screen.getByRole('dialog')
  return { dialog, view: within(dialog), unmount }
}

async function upload(dialog: HTMLElement, content: string, name = 'export.json'): Promise<File> {
  const file = new File([content], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: async () => content })
  await act(async () => {
    fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } })
  })
  return file
}

async function confirmImport(view: ReturnType<typeof within>, count: number): Promise<void> {
  await act(async () => {
    fireEvent.click(view.getByText(`导入 ${count} 个对话`, { selector: 'button span' }))
  })
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
  it('旧版预览可选择嵌套文件夹，并在筛选和勾选时保留目标', async () => {
    useFoldersStore.getState().setFolders([
      { id: 'research', kind: 'folder', name: '研究', createdAt: 1, orderKey: 'a0' },
      {
        id: 'papers',
        kind: 'folder',
        name: '论文',
        parentFolderId: 'research',
        createdAt: 1,
        orderKey: 'a0'
      }
    ])
    const { dialog, view } = renderImportModal()
    await upload(dialog, JSON.stringify(data))
    expect(view.getByText('对话1')).toBeTruthy()
    const folder = view.getByLabelText('目标文件夹')
    expect(folder).toHaveProperty('value', '导入 Pointer 旧版 聊天文件-2026-11-22')
    expect(command).not.toHaveBeenCalled()
    fireEvent.mouseDown(folder)
    fireEvent.click(
      await screen.findByText('研究 / 论文', { selector: '.ant-select-item-option-content' })
    )
    expect(folder).toHaveProperty('value', '研究 / 论文')
    const secondRow = view.getByText('对话2').closest('tr')!
    fireEvent.click(within(secondRow).getByRole('checkbox'))
    fireEvent.change(view.getByPlaceholderText('搜索标题...'), { target: { value: '对话1' } })
    expect(view.queryByText('对话2')).toBeNull()
    expect(folder).toHaveProperty('value', '研究 / 论文')
    await confirmImport(view, 1)
    expect(view.getByText('成功: 1 个')).toBeTruthy()
    expect(command).toHaveBeenCalledWith(
      'library.import',
      expect.objectContaining({ source: 'pointer', ids: ['p1'], folderId: 'papers' })
    )
  })
  it('损坏文件停留在上传步骤，导入失败显示文件错误且不自动重试', async () => {
    const { dialog, view } = renderImportModal()
    await upload(dialog, '{')
    expect(screen.getByText('文件解析失败，请确保是有效的 JSON 文件')).toBeTruthy()
    expect(command).not.toHaveBeenCalled()
    await upload(dialog, JSON.stringify(data))
    expect(view.getByText('对话1')).toBeTruthy()
    vi.mocked(command).mockRejectedValueOnce(new Error('无法写入工作区'))
    await confirmImport(view, 2)
    expect(view.getByText(/import.json：无法写入工作区/)).toBeTruthy()
    expect(view.getByText('成功: 0 个')).toBeTruthy()
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('索引导入预填年月日，可改名新建并在重试时保留目标', async () => {
    const { dialog, view } = renderImportModal()
    vi.mocked(prepareDeepSeekIndex).mockResolvedValueOnce({
      draftId: 'draft',
      sessions: [
        { id: 's1', title: '新版一', createdAt: 1700000000000, messageCount: 5 },
        { id: 's2', title: '新版二', createdAt: 1700000000000, messageCount: 7 }
      ]
    })
    const index = await upload(dialog, '[]', 'chat_session_index.json')
    expect(prepareDeepSeekIndex).toHaveBeenCalledExactlyOnceWith(index)
    const first = view.getByText('新版一').closest('tr')!
    expect(within(first).getByText('5')).toBeTruthy()
    const folder = view.getByLabelText('目标文件夹')
    expect(folder).toHaveProperty('value', '导入 DeepSeek 聊天文件-2026-11-22')
    fireEvent.change(folder, { target: { value: '会话归档' } })
    const second = view.getByText('新版二').closest('tr')!
    fireEvent.click(within(second).getByRole('checkbox'))
    expect(command).not.toHaveBeenCalled()

    vi.mocked(command).mockRejectedValueOnce(new Error('chat_sessions/s1.json：找不到文件'))
    await confirmImport(view, 1)
    expect(view.getByText('chat_sessions/s1.json：找不到文件')).toBeTruthy()
    expect(view.getByLabelText('目标文件夹')).toHaveProperty('value', '会话归档')
    expect(within(view.getByText('新版二').closest('tr')!).getByRole('checkbox')).toHaveProperty(
      'checked',
      false
    )
    await confirmImport(view, 1)
    expect(view.getByText('成功: 1 个')).toBeTruthy()
    expect(vi.mocked(command).mock.calls).toEqual([
      ['library.importDeepSeekIndex', { draftId: 'draft', ids: ['s1'], folderName: '会话归档' }],
      ['library.importDeepSeekIndex', { draftId: 'draft', ids: ['s1'], folderName: '会话归档' }]
    ])
  })

  it('独立会话只预览一项，清空后导入工作区根目录', async () => {
    const { dialog, view } = renderImportModal()
    const payload = JSON.stringify({
      id: 'standalone',
      title: '单条新版会话',
      current_message_id: 1,
      messages: [{ id: 1, parent_id: null, role: 'USER', fragments: [] }]
    })
    await upload(dialog, payload, 'renamed-session.json')
    expect(view.getByText('单条新版会话')).toBeTruthy()
    expect(view.getByText('共 1 个对话')).toBeTruthy()
    expect(prepareDeepSeekIndex).not.toHaveBeenCalled()
    expect(command).not.toHaveBeenCalled()
    const folder = view.getByLabelText('目标文件夹')
    expect(folder).toHaveProperty('value', '导入 DeepSeek 聊天文件-2026-11-22')
    fireEvent.mouseDown(folder.closest('.ant-select')!.querySelector('.ant-select-clear')!)
    expect(folder).toHaveProperty('value', '')

    await confirmImport(view, 1)
    expect(view.getByText('成功: 1 个')).toBeTruthy()
    expect(command).toHaveBeenCalledExactlyOnceWith('library.import', {
      source: 'deepseek',
      payload,
      ids: ['standalone']
    })
  })

  it('英文说明位于点击或拖拽区，索引文件名以行内代码显示', async () => {
    await rendererI18n.changeLanguage('en-US')
    const { view, unmount } = renderImportModal()
    try {
      const hint = view
        .getByText('Click or drag a file here')
        .parentElement!.querySelector('.ant-upload-hint')
      expect(hint?.textContent?.trim()).toBe(
        'Supports .json export files. For DeepSeek, choose chat_session_index.json or an individual conversation JSON.'
      )
      expect(hint?.querySelector('code')?.textContent).toBe('chat_session_index.json')
      expect(
        view.queryByText('Select DeepSeek session index', { selector: 'button span' })
      ).toBeNull()
    } finally {
      unmount()
      await rendererI18n.changeLanguage('zh-CN')
    }
  })
})

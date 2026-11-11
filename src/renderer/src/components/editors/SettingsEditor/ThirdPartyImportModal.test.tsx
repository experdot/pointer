import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThirdPartyImportModal } from './ThirdPartyImportModal'
import { command } from '../../../runtime/client'

vi.mock('../../../runtime/client', () => ({ command: vi.fn() }))
beforeEach(() => {
  const computed = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => computed(element))
  vi.mocked(command).mockReset().mockResolvedValue({ importedPages: 1, importedMessages: 1 })
})
async function upload(content: string): Promise<void> {
  const file = new File([content], 'export.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: async () => content })
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } })
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
    fireEvent.click(screen.getByRole('button', { name: '导入 1 个对话' }))
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
    fireEvent.click(screen.getByRole('button', { name: '导入 2 个对话' }))
    await waitFor(() => expect(screen.getByText(/import.json：无法写入工作区/)).toBeTruthy())
    expect(screen.getByText('成功: 0 个')).toBeTruthy()
    expect(command).toHaveBeenCalledTimes(1)
  })
})

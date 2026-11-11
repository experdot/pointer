import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TableViewModal from './TableViewModal'
import { screenshotElement } from '../../../utils/screenshot'
import { command } from '../../../runtime/client'
import { copyToClipboard } from '../../../utils/clipboard'

vi.mock('./Markdown', () => ({
  Markdown: ({ content }: { content: string }) => <div>{content}</div>
}))
vi.mock('../../../utils/screenshot', () => ({ screenshotElement: vi.fn() }))
vi.mock('../../../runtime/client', () => ({ command: vi.fn() }))
vi.mock('../../../utils/clipboard', () => ({ copyToClipboard: vi.fn() }))
beforeEach(() => {
  vi.mocked(screenshotElement)
    .mockReset()
    .mockResolvedValue(new Blob([new Uint8Array([0, 1, 255])], { type: 'image/png' }))
  vi.mocked(command).mockReset().mockResolvedValue({})
  vi.mocked(copyToClipboard).mockReset().mockResolvedValue(true)
})
function modal(): void {
  render(
    <TableViewModal
      isOpen
      onClose={vi.fn()}
      tableHtml="<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>=SUM(1,2)</td></tr></tbody></table>"
      tableMarkdown="|A|\n|---|\n|=SUM(1,2)|"
      tableTextMarkdown="A：=SUM(1,2)"
    />
  )
}
describe('表格全屏查看与图片导出', () => {
  it('截图使用当前视图的隐藏容器，浏览器编码保留 PNG 字节', async () => {
    modal()
    fireEvent.click(screen.getByRole('button', { name: '导出图片' }))
    await waitFor(() => expect(command).toHaveBeenCalled())
    expect(command).toHaveBeenLastCalledWith(
      'dialog.saveFile',
      expect.objectContaining({ content: 'AAH/', encoding: 'base64' })
    )
    const tableTarget = vi.mocked(screenshotElement).mock.calls[0][0]
    expect(tableTarget.querySelector('table')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '文本' }))
    fireEvent.click(screen.getByRole('button', { name: '导出图片' }))
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2))
    const textTarget = vi.mocked(screenshotElement).mock.calls[1][0]
    expect(textTarget).not.toBe(tableTarget)
    expect(textTarget.textContent).toBe('A：=SUM(1,2)')
  })
  it('CSV 同样保护公式前缀，保存/复制失败显示错误并允许重试', async () => {
    modal()
    vi.mocked(command).mockRejectedValueOnce(new Error('保存被拒绝'))
    fireEvent.click(screen.getByRole('button', { name: '导出CSV' }))
    await screen.findByText('保存被拒绝')
    fireEvent.click(screen.getByRole('button', { name: '导出CSV' }))
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2))
    expect(command).toHaveBeenLastCalledWith(
      'dialog.saveFile',
      expect.objectContaining({ content: 'A\n"\'=SUM(1,2)"' })
    )
    vi.mocked(copyToClipboard).mockResolvedValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: '复制Markdown' }))
    await screen.findByText('复制失败，请重试')
    fireEvent.click(screen.getByRole('button', { name: '复制Markdown' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

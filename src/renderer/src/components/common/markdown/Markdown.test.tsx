import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Markdown } from './Markdown'

const io = vi.hoisted(() => ({ copy: vi.fn(), command: vi.fn() }))
vi.mock('../../../utils/clipboard', () => ({ copyToClipboard: io.copy }))
vi.mock('../../../runtime/client', () => ({ command: io.command }))
vi.mock('./TableViewModal', () => ({ default: () => null }))
beforeEach(() => {
  io.copy.mockReset().mockResolvedValue(true)
  io.command.mockReset().mockResolvedValue({})
})

describe('真实 Markdown 渲染与代码操作', () => {
  it('代码中的美元参数与 Markdown 符号按原文显示、复制和下载', async () => {
    const code = 'echo "$1"\n**literal** <tag> \\(x\\)\n'
    const { container } = render(<Markdown content={`\`\`\`sh\n${code}\`\`\``} />)
    expect(container.querySelector('pre code')?.textContent).toBe(code)
    fireEvent.click(screen.getByTitle('复制代码'))
    await waitFor(() => expect(io.copy).toHaveBeenCalledWith(code))
    expect(screen.getByTitle('已复制!')).toBeTruthy()
    fireEvent.click(screen.getByTitle('下载代码'))
    await waitFor(() =>
      expect(io.command).toHaveBeenCalledWith(
        'dialog.saveFile',
        expect.objectContaining({ content: code, suggestedName: expect.stringMatching(/\.sh$/) })
      )
    )
  })
  it('不完整流式代码后补齐围栏仍能显示全部代码，不把代码当公式', () => {
    const { container, rerender } = render(<Markdown content={'```text\n$1'} />)
    expect(container.querySelector('pre code')?.textContent).toBe('$1\n')
    rerender(<Markdown content={'```text\n$1\n$2\n```'} />)
    expect(container.querySelector('pre code')?.textContent).toBe('$1\n$2\n')
    expect(container.querySelector('.katex')).toBeNull()
  })
  it('公式、表格和原始 HTML 安全边界', () => {
    const { container } = render(
      <Markdown
        content={
          '\\(x+1\\)\n\n| A | B |\n|---|---|\n| 中文 | emoji🧪 |\n\n<script>alert(1)</script>\n\n[危险](javascript:alert%281%29)'
        }
      />
    )
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('table')?.textContent).toContain('中文')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).not.toMatch(/^javascript:/)
  })

  it('数字开头的公式保留数学语义，连续两个价格保持文本', () => {
    const { container } = render(<Markdown content={'$2+2$\n\n价格 $5 和 $10'} />)
    expect(container.querySelectorAll('.katex')).toHaveLength(1)
    expect(container.textContent).toContain('价格 $5 和 $10')
  })
  it('复制失败不显示成功，下载失败解除进行中状态后允许重试', async () => {
    io.copy.mockResolvedValue(false)
    io.command.mockRejectedValueOnce(new Error('磁盘满'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<Markdown content={'```text\nkeep\n```'} />)
    fireEvent.click(screen.getByTitle('复制代码'))
    await waitFor(() => expect(io.copy).toHaveBeenCalled())
    expect(screen.queryByTitle('已复制!')).toBeNull()
    fireEvent.click(screen.getByTitle('下载代码'))
    await waitFor(() => expect(io.command).toHaveBeenCalledTimes(1))
    fireEvent.click(await screen.findByTitle('下载代码'))
    await waitFor(() => expect(io.command).toHaveBeenCalledTimes(2))
  })
})

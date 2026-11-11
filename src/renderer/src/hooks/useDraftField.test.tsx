import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDraftField } from './useDraftField'

function Field({
  value,
  commit
}: {
  value: string
  commit: (value: string) => void
}): React.JSX.Element {
  const draft = useDraftField(value, commit)
  return (
    <input
      aria-label="配置名称"
      value={draft.value}
      onChange={(event) => draft.setValue(event.target.value)}
      {...draft.handlers}
    />
  )
}

describe('配置输入草稿的真实 DOM 事件', () => {
  it.each(['end-last', 'change-last'] as const)(
    '中文输入事件顺序 %s 只提交一次完整文本',
    (order) => {
      const commit = vi.fn()
      render(<Field value="" commit={commit} />)
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.focus(input)
      fireEvent.compositionStart(input)
      fireEvent.change(input, { target: { value: 'zhong' } })
      expect(commit).not.toHaveBeenCalled()
      if (order === 'end-last') fireEvent.change(input, { target: { value: '中文' } })
      fireEvent.compositionEnd(input, { target: { value: '中文' }, data: '中文' })
      if (order === 'change-last') fireEvent.change(input, { target: { value: '中文' } })
      expect(input.value).toBe('中文')
      expect(commit.mock.calls).toEqual([['中文']])
    }
  )

  it('组词中失焦仍提交最终草稿，后到的 compositionEnd 不重复提交', () => {
    const commit = vi.fn()
    render(<Field value="" commit={commit} />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '最终名称' } })
    fireEvent.blur(input)
    fireEvent.compositionEnd(input)
    expect(commit.mock.calls).toEqual([['最终名称']])
  })

  it('编辑时旧回执不覆盖输入，结束编辑后跟随外部更新', () => {
    const commit = vi.fn()
    const view = render(<Field value="旧值" commit={commit} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '新值' } })
    view.rerender(<Field value="更旧回执" commit={commit} />)
    expect(input.value).toBe('新值')
    fireEvent.blur(input)
    view.rerender(<Field value="其他配置" commit={commit} />)
    expect(input.value).toBe('其他配置')
    expect(commit.mock.calls).toEqual([['新值']])
  })
})

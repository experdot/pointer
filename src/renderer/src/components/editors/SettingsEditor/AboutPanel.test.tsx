import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AboutPanel } from './AboutPanel'
import { useUpdateStore } from '../../../stores/updateStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { command, query } from '../../../runtime/client'

vi.mock('../../../runtime/client', () => ({
  command: vi.fn(),
  query: vi.fn(),
  errorMessage: (error: Error) => error.message
}))
vi.mock('../../common/markdown/Markdown', () => ({
  Markdown: ({ content }: { content: string }) => <div>{content}</div>
}))
beforeEach(() => {
  const computed = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => computed(element))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  useUpdateStore.getState().resetUpdateState()
  useSettingsStore.getState().reset()
  vi.mocked(query).mockReset().mockResolvedValue('2.0.0-test')
  vi.mocked(command).mockReset().mockResolvedValue({ available: false })
})
describe('更新界面的状态与安装前保存', () => {
  it('版本只查询一次，检查失败后能重试；下载进度和完成状态由事件驱动', async () => {
    render(
      <App>
        <AboutPanel />
      </App>
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    vi.mocked(command).mockRejectedValueOnce(new Error('无法访问更新源'))
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await screen.findByText('无法访问更新源')
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    await screen.findByText('当前已是最新版本')
    act(() => useUpdateStore.getState().applyStatus({ state: 'available', version: '2.1.0' }))
    vi.mocked(command).mockRejectedValueOnce(new Error('下载中断'))
    fireEvent.click(screen.getByRole('button', { name: '下载更新' }))
    await screen.findByText('下载中断')
    fireEvent.click(screen.getByRole('button', { name: '下载更新' }))
    act(() =>
      useUpdateStore.getState().applyStatus({ state: 'downloading', version: '2.1.0', percent: 42 })
    )
    expect(screen.getByText('42%')).toBeTruthy()
    act(() => useUpdateStore.getState().applyStatus({ state: 'downloaded', version: '2.1.0' }))
    expect(screen.getByRole('button', { name: '安装并重启' })).toBeTruthy()
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('未保存回答阻止安装，重试只保存对应请求后再请求安装', async () => {
    useUpdateStore.getState().applyStatus({ state: 'downloaded', version: '2.1.0' })
    let finishSave!: () => void
    const saving = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    vi.mocked(command)
      .mockRejectedValueOnce(
        Object.assign(new Error('尚未保存'), { code: 'chat.unsaved', details: ['request'] })
      )
      .mockReturnValueOnce(saving)
      .mockResolvedValue(undefined)
    render(
      <App>
        <AboutPanel />
      </App>
    )
    // 等待交互后的状态更新，按标题限定弹窗范围，减少 jsdom 的重复样式计算。
    await act(async () => {
      fireEvent.click(screen.getByLabelText('安装并重启'))
    })
    const installDialog = screen
      .getAllByText('安装更新')[0]
      .closest<HTMLElement>('[role="dialog"]')!
    await act(async () => {
      fireEvent.click(within(installDialog).getByRole('button', { name: /^安\s*装$/ }))
    })
    const saveDialog = screen
      .getAllByText('回答尚未保存')[0]
      .closest<HTMLElement>('[role="dialog"]')!
    expect(vi.mocked(command).mock.calls.map(([name]) => name)).toEqual(['app.quitAndInstall'])
    await act(async () => {
      fireEvent.click(within(saveDialog).getByRole('button', { name: '重试保存' }))
    })
    expect(vi.mocked(command).mock.calls.map(([name]) => name)).toEqual([
      'app.quitAndInstall',
      'chat.retrySave'
    ])
    expect(command).toHaveBeenNthCalledWith(2, 'chat.retrySave', { requestId: 'request' })
    await act(async () => finishSave())
    expect(vi.mocked(command).mock.calls.map(([name]) => name)).toEqual([
      'app.quitAndInstall',
      'chat.retrySave',
      'app.quitAndInstall'
    ])
  })
})

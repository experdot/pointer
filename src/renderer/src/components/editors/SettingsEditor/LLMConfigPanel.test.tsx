import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/domain'
import type { SettingsSnapshot } from '@shared/contracts'
import { deferred } from '../../../../../../tests/helpers/deferred'
import { useSettingsStore } from '../../../stores/settingsStore'
import { LLMConfigPanel } from './LLMConfigPanel'

const client = vi.hoisted(() => ({ command: vi.fn(), query: vi.fn() }))
vi.mock('../../../runtime/client', () => client)
// 配置树的创建/选择由桌面用例覆盖；此处挂载真实表单与设置 store，专测提交时序。
vi.mock('../../common/ConfigTree', () => ({ ConfigTree: () => null }))

beforeEach(() => {
  client.command.mockReset()
  client.query.mockReset()
  useSettingsStore.getState().reset()
  const settings = defaultSettings()
  settings.llmConfigs.items = [
    {
      id: 'llm',
      kind: 'item',
      name: '测试',
      order: 0,
      createdAt: 1,
      baseUrl: 'http://old.invalid/v1',
      apiKey: 'old-key',
      modelName: 'old-model'
    }
  ]
  useSettingsStore.getState().accept({ settings, revision: 1 })
  client.command.mockImplementation(async (_name, payload) => ({
    settings: payload.settings,
    revision: 2,
    mutationId: payload.mutationId
  }))
  client.query.mockResolvedValue({ ok: true, message: '连接成功', models: ['new-model'] })
})
afterEach(() => {
  act(() => useSettingsStore.getState().reset())
})

describe('模型配置的真实表单与设置提交', () => {
  it('立即测试连接必须等待刚编辑的配置确认落盘', async () => {
    const saving = deferred<SettingsSnapshot>()
    client.command.mockReturnValueOnce(saving.promise)
    render(
      <App>
        <LLMConfigPanel />
      </App>
    )
    fireEvent.change(screen.getByLabelText('API Base URL', { selector: 'input' }), {
      target: { value: 'http://new.invalid/v1' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'new-key' } })
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    await waitFor(() => expect(client.command).toHaveBeenCalledTimes(1))
    expect(client.query).not.toHaveBeenCalled()
    const payload = client.command.mock.calls[0][1]
    expect(payload.settings.llmConfigs.items[0]).toMatchObject({
      baseUrl: 'http://new.invalid/v1',
      apiKey: 'new-key'
    })
    await act(async () =>
      saving.resolve({ settings: payload.settings, revision: 2, mutationId: payload.mutationId })
    )
    await waitFor(() => expect(client.query).toHaveBeenCalledWith('ai.test', { llmId: 'llm' }))
    expect(await screen.findByText('连接成功')).toBeTruthy()
  })

  it('保存失败不使用旧配置测试，修改保留并允许再次点击重试', async () => {
    client.command.mockRejectedValueOnce(new Error('磁盘只读'))
    render(
      <App>
        <LLMConfigPanel />
      </App>
    )
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'retry-key' } })
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    expect(await screen.findByText('测试失败')).toBeTruthy()
    expect(client.query).not.toHaveBeenCalled()
    expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('retry-key')
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    expect(await screen.findByText('连接成功')).toBeTruthy()
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('获取模型列表也先提交新的地址和密钥', async () => {
    render(
      <App>
        <LLMConfigPanel />
      </App>
    )
    fireEvent.change(screen.getByLabelText('API Base URL', { selector: 'input' }), {
      target: { value: 'http://models.invalid/v1' }
    })
    fireEvent.focus(screen.getByLabelText('模型名称', { selector: 'input' }))
    await waitFor(() => expect(client.query).toHaveBeenCalledWith('ai.models', { llmId: 'llm' }))
    expect(client.command).toHaveBeenCalledTimes(1)
    expect(client.command.mock.invocationCallOrder[0]).toBeLessThan(
      client.query.mock.invocationCallOrder[0]
    )
  })
})

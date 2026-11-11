/// <reference types="electron-vite/node" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportModal } from './ExportModal'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useViewStateStore } from '../../../stores/viewStateStore'
import { createKernel, type KernelFixture } from '../../../../../../tests/helpers/kernel'
import type { BackupData } from '@shared/contracts'
import { query } from '../../../runtime/client'

vi.mock('../../../runtime/client', () => ({ query: vi.fn(), command: vi.fn() }))
let f: KernelFixture
let downloaded: Blob[]
beforeEach(async () => {
  const computed = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => computed(element))
  f = await createKernel()
  downloaded = []
  vi.mocked(query)
    .mockReset()
    .mockImplementation((name, payload) => f.query(name, payload))
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      downloaded.push(blob)
      return 'blob:test'
    })
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  useSettingsStore.getState().reset()
  usePagesStore.getState().reset()
  useFoldersStore.getState().reset()
  useViewStateStore.getState().reset()
})
afterEach(async () => {
  await f.dispose()
})
async function mirrors(): Promise<void> {
  const tree = await f.query('tree.get', undefined)
  usePagesStore.setState({ pages: tree.pages, initialized: true })
  useFoldersStore.getState().setFolders(tree.folders)
  useSettingsStore.getState().accept(await f.query('settings.get', undefined))
  useViewStateStore.getState().setViewState(await f.query('viewState.get', undefined))
}
async function contents(): Promise<BackupData> {
  await waitFor(() => expect(downloaded).toHaveLength(1))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(JSON.parse(String(reader.result)))
    reader.onerror = reject
    reader.readAsText(downloaded[0])
  })
}
describe('界面实际备份产物与内核恢复', () => {
  it('备份保留默认配置、消息和 UI 引用，默认移除密钥，重复恢复正确映射', async () => {
    const settings = await f.configure()
    settings.modelConfigs.items = [
      {
        id: 'params',
        name: '参数',
        kind: 'item',
        order: 0,
        createdAt: 1,
        systemPrompt: 'system',
        temperature: 0.2,
        topP: 0.8
      }
    ]
    settings.defaultModelConfigId = 'params'
    await f.command('settings.replace', { settings })
    const folder = await f.command('folder.create', { name: '文件夹' })
    const page = await f.command('page.create', { name: '对话', parentFolderId: folder.id })
    await f.command('conversation.append', {
      pageId: page.id,
      draft: { id: 'm', role: 'user', content: '需要备份的内容' }
    })
    const viewState = await f.query('viewState.get', undefined)
    viewState.tabs = [{ id: 'tab', type: 'chat', title: '对话', dataId: page.id }]
    viewState.activeTabId = 'tab'
    await f.command('viewState.replace', { viewState })
    await mirrors()
    render(
      <App>
        <ExportModal open onClose={vi.fn()} />
      </App>
    )
    fireEvent.click(screen.getByRole('tab', { name: '界面' }))
    fireEvent.click(screen.getByLabelText('包含标签页和布局设置'))
    fireEvent.click(screen.getByRole('button', { name: '导出选中项' }))
    const backup = await contents()
    expect(backup.data.settings?.defaultLLMId).toBe(settings.defaultLLMId)
    expect(backup.data.settings?.defaultModelConfigId).toBe('params')
    expect(backup.data.settings?.llmConfigs?.items[0].apiKey).toBe('')
    expect(backup.data.messages?.[0].messages[0].content).toBe('需要备份的内容')
    const restored = await f.command('backup.restore', {
      backup,
      strategy: 'generate-new',
      selection: {
        pages: [page.id],
        folders: [folder.id],
        llm: ['llm'],
        llmFolders: [],
        models: ['params'],
        modelFolders: [],
        ui: true
      }
    })
    expect(restored.error).toBeUndefined()
    expect(restored.ids.pages[page.id]).not.toBe(page.id)
    await f.restart()
    const current = await f.query('viewState.get', undefined)
    expect(current.tabs.find((tab) => tab.id === current.activeTabId)?.dataId).toBe(
      restored.ids.pages[page.id]
    )
    expect((await f.query('settings.get', undefined)).settings.defaultLLMId).toBe(
      restored.ids.llm.llm
    )
    expect(
      (await f.query('conversation.get', { pageId: restored.ids.pages[page.id] })).messages[0]
        .content
    ).toBe('需要备份的内容')
  })
  it('空文件夹可以单独备份，密钥只在明确勾选后导出', async () => {
    await f.command('folder.create', { name: '空文件夹' })
    await mirrors()
    const view = render(
      <App>
        <ExportModal open onClose={vi.fn()} />
      </App>
    )
    fireEvent.click(screen.getByRole('button', { name: '导出选中项' }))
    expect((await contents()).data.folders?.[0].name).toBe('空文件夹')
    view.unmount()
    downloaded = []
    await f.configure()
    await mirrors()
    render(
      <App>
        <ExportModal open onClose={vi.fn()} />
      </App>
    )
    fireEvent.click(screen.getByRole('tab', { name: /LLM配置/ }))
    fireEvent.click(screen.getByLabelText('包含 API Key（明文）'))
    fireEvent.click(screen.getByRole('button', { name: '导出选中项' }))
    expect((await contents()).data.settings?.llmConfigs?.items[0].apiKey).toBe('test-only')
  })
  it('会话读取失败不下载半份备份，错误后可以重试', async () => {
    await f.command('page.create', { name: '重试' })
    await mirrors()
    vi.mocked(query).mockRejectedValueOnce(new Error('页面暂不可读'))
    const close = vi.fn()
    render(
      <App>
        <ExportModal open onClose={close} />
      </App>
    )
    fireEvent.click(screen.getByRole('button', { name: '导出选中项' }))
    await waitFor(() => expect(screen.getByText(/页面暂不可读/)).toBeTruthy())
    expect(downloaded).toEqual([])
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '导出选中项' }))
    expect((await contents()).data.pages).toHaveLength(1)
  })
})

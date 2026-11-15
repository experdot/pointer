import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/domain'
import { LocalizedError, msg } from '@shared/i18n/message'
import type { SupportedLanguage } from '@shared/domain/locale'
import { useLocaleStore } from './stores/localeStore'
import { useSettingsStore } from './stores/settingsStore'
import { useMessagesStore } from './stores/messagesStore'
import { usePagesStore } from './stores/pagesStore'
import { useFoldersStore } from './stores/foldersStore'
import { ExportModal } from './components/editors/SettingsEditor/ExportModal'
import { LLMConfigPanel } from './components/editors/SettingsEditor/LLMConfigPanel'
import { ModelConfigPanel } from './components/editors/SettingsEditor/ModelConfigPanel'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { MessagesSourceSelector } from './components/editors/ExportEditor/sources/MessagesSource'
import { tablePreviewerPlugin } from './features/export/plugins/previewers/tablePreviewer'
import { csvEditorPlugin } from './features/export/plugins/editors/csvEditor'
import { DEFAULT_PREVIEW_OPTIONS } from './features/export/types'

async function setLanguage(language: SupportedLanguage): Promise<void> {
  await act(async () =>
    useLocaleStore.getState().accept({
      preference: language,
      language,
      systemLanguage: 'en-US',
      revision: (useLocaleStore.getState().snapshot?.revision ?? 0) + 1
    })
  )
}

beforeEach(async () => {
  useLocaleStore.setState({ snapshot: null, saving: false })
  await setLanguage('en-US')
  useSettingsStore.getState().reset()
  useSettingsStore.getState().accept({ settings: defaultSettings(), revision: 1 })
  useMessagesStore.getState().reset()
  usePagesStore.getState().reset()
  useFoldersStore.getState().reset()
  let revision = 1
  window.runtime = {
    command: vi.fn(async (_name, payload) => ({ ...payload, revision: ++revision }))
  } as unknown as Window['runtime']
})

describe('语言切换中的菜单与默认文案', () => {
  it.each([
    ['LLM', LLMConfigPanel, 'llmConfigs'],
    ['模型', ModelConfigPanel, 'modelConfigs']
  ] as const)('%s 配置仅新增时使用当前语言，已有名称保持不变', async (_, Panel, key) => {
    const { container } = render(
      <App>
        <Panel />
      </App>
    )
    const toolbar = within(container.querySelector<HTMLElement>('.config-tree-toolbar')!)
    fireEvent.click(toolbar.getByText('New configuration'))
    await act(async () => useSettingsStore.getState().flush())
    expect(useSettingsStore.getState().settings[key].items[0].name).toBe('New configuration')
    await setLanguage('zh-CN')
    expect(useSettingsStore.getState().settings[key].items[0].name).toBe('New configuration')
    fireEvent.click(toolbar.getByText('新建配置'))
    await act(async () => useSettingsStore.getState().flush())
    expect(useSettingsStore.getState().settings[key].items.map((item) => item.name)).toEqual([
      'New configuration',
      '新配置'
    ])
    if (key === 'modelConfigs') {
      expect(screen.getByText('温度（Temperature）')).toBeTruthy()
      expect(screen.getByText('核采样（Top P）')).toBeTruthy()
    }
  })

  // 文件夹命名与模型表单分开验证，避免在同一用例中反复扫描完整 Ant Design 表单。
  it.each([
    ['LLM', LLMConfigPanel, 'llmConfigs'],
    ['模型', ModelConfigPanel, 'modelConfigs']
  ] as const)('%s 文件夹菜单刷新语言，已有文件夹名称保持不变', async (_, Panel, key) => {
    const { container } = render(
      <App>
        <Panel />
      </App>
    )
    const toolbar = within(container.querySelector<HTMLElement>('.config-tree-toolbar')!)
    const folderTrigger = toolbar.getByRole('button', { name: 'ellipsis' })
    fireEvent.mouseEnter(folderTrigger)
    const menu = await screen.findByRole('menu')
    await act(async () => {
      fireEvent.click(within(menu).getByText('New folder'))
      fireEvent.mouseLeave(folderTrigger)
      await useSettingsStore.getState().flush()
    })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(useSettingsStore.getState().settings[key].folders[0].name).toBe('New folder')
    await setLanguage('zh-CN')
    expect(useSettingsStore.getState().settings[key].folders[0].name).toBe('New folder')
    fireEvent.mouseEnter(folderTrigger)
    const reopenedMenu = await screen.findByRole('menu')
    await act(async () => {
      fireEvent.click(within(reopenedMenu).getByText('新建文件夹'))
      await useSettingsStore.getState().flush()
    })
    expect(useSettingsStore.getState().settings[key].folders.map((folder) => folder.name)).toEqual([
      'New folder',
      '新文件夹'
    ])
  })

  it('LLM 表单标签与已打开的服务预设随语言切换', async () => {
    await setLanguage('zh-CN')
    const { container } = render(
      <App>
        <LLMConfigPanel />
      </App>
    )
    const toolbar = within(container.querySelector<HTMLElement>('.config-tree-toolbar')!)
    fireEvent.click(toolbar.getByText('新建配置'))
    await act(async () => useSettingsStore.getState().flush())
    const address = screen.getByLabelText('API 基础地址', { selector: 'input' })
    expect(screen.getByLabelText('API 密钥')).toBeTruthy()
    fireEvent.focus(address)
    fireEvent.mouseDown(address)
    expect(await screen.findByText('Ollama 本地服务')).toBeTruthy()
    await setLanguage('en-US')
    expect(await screen.findByText('Ollama Local')).toBeTruthy()
    expect(screen.getByLabelText('API Key')).toBeTruthy()
    expect(useSettingsStore.getState().settings.llmConfigs.items[0].name).toBe('新配置')
  })

  it('导出范围下拉菜单打开时刷新标签，选择与对话内容保持不变', async () => {
    const conversation = {
      pageId: 'page',
      messages: [
        { id: 'message', role: 'user' as const, content: '用户原文', branchIndex: 0, createdAt: 1 }
      ],
      topics: [],
      leafMessageId: 'message',
      updatedAt: 1
    }
    useMessagesStore.getState().setConversation(conversation)
    const onChange = vi.fn()
    render(
      <App>
        <MessagesSourceSelector
          pageId="page"
          data={{
            type: 'messages',
            pageId: 'page',
            selectionMode: 'current-branch',
            selectedMessageIds: ['message']
          }}
          onChange={onChange}
        />
      </App>
    )
    const select = await screen.findByLabelText('Message selection mode', { selector: 'input' })
    fireEvent.mouseDown(select)
    expect(await screen.findByText('All branches')).toBeTruthy()
    const changesBefore = onChange.mock.calls.length
    await setLanguage('zh-CN')
    expect(await screen.findByText('所有分支')).toBeTruthy()
    expect(screen.queryByText('All branches')).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(changesBefore)
    expect(useMessagesStore.getState().get('page')).toEqual(conversation)
  })

  it('表格预览的空列名随语言刷新，已有列标题保持原文', async () => {
    const Previewer = tablePreviewerPlugin.Component
    render(
      <Previewer
        result={{
          content: ',我的标题\none,two',
          isBinary: false,
          extension: 'csv',
          mimeType: 'text/csv'
        }}
        options={DEFAULT_PREVIEW_OPTIONS}
      />
    )
    expect(screen.getByText('Column 1', { selector: 'th' })).toBeTruthy()
    await setLanguage('zh-CN')
    expect(screen.getByText('第 1 列', { selector: 'th' })).toBeTruthy()
    expect(screen.getByText('我的标题', { selector: 'th' })).toBeTruthy()
  })

  it('备份树中的未命名占位文本刷新语言，已取消的选择不被重置', async () => {
    usePagesStore.setState({
      pages: [
        { id: 'empty', kind: 'page', name: '', createdAt: 1, orderKey: 'a0' },
        { id: 'named', kind: 'page', name: '用户标题', createdAt: 1, orderKey: 'a1' }
      ]
    })
    render(
      <App>
        <ExportModal open onClose={vi.fn()} />
      </App>
    )
    expect(screen.getByText('Untitled conversation')).toBeTruthy()
    const checkbox = screen
      .getByText('用户标题')
      .closest('.ant-tree-treenode')!
      .querySelector('.ant-tree-checkbox')!
    fireEvent.click(checkbox)
    expect(checkbox.classList.contains('ant-tree-checkbox-checked')).toBe(false)
    await setLanguage('zh-CN')
    expect(screen.getByText('未命名对话')).toBeTruthy()
    expect(screen.getByText('用户标题')).toBeTruthy()
    expect(checkbox.classList.contains('ant-tree-checkbox-checked')).toBe(false)
    expect(usePagesStore.getState().pages[0].name).toBe('')
  })

  it('CSV 新增列按当前语言命名，已有列标题不会被语言切换改写', async () => {
    const Editor = csvEditorPlugin.Component
    const onChange = vi.fn()
    const { container } = render(
      <Editor
        content={'自定义\nvalue'}
        format="csv"
        options={DEFAULT_PREVIEW_OPTIONS}
        onChange={onChange}
      />
    )
    const header = within(container.querySelector<HTMLElement>('thead')!)
    await setLanguage('zh-CN')
    // 限定真实表头，避开隐藏的列宽测量副本及整页可访问名称计算。
    fireEvent.click(header.getByText('列', { selector: 'button span' }))
    expect(onChange.mock.lastCall?.[0]).toBe('自定义,第 2 列\nvalue,')
    await setLanguage('en-US')
    expect(screen.getAllByText('第 2 列').length).toBeGreaterThan(0)
    fireEvent.click(header.getByText('Column', { selector: 'button span' }))
    expect(onChange.mock.lastCall?.[0]).toBe('自定义,第 2 列,Column 3\nvalue,,')
  })

  it('错误兜底页仍可刷新语言', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const Crash = (): never => {
      throw new Error('diagnostic')
    }
    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    await setLanguage('zh-CN')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull())
    expect(screen.getByText('diagnostic')).toBeTruthy()
    expect(screen.getByRole('button', { name: /重新加载/ })).toBeTruthy()
  })

  it('错误兜底页保留错误的翻译描述', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const Crash = (): never => {
      throw new LocalizedError(msg('errors.settings.defaultLlmMissing'))
    }
    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>
    )
    expect(screen.getByText('The default LLM connection does not exist')).toBeTruthy()
    await setLanguage('zh-CN')
    expect(screen.getByText('默认 LLM 配置不存在')).toBeTruthy()
  })
})

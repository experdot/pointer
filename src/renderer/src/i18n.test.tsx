import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App, ConfigProvider, Empty } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralPanel } from './components/editors/SettingsEditor/GeneralPanel'
import { DateTimeText } from './components/common/DateTimeText'
import { MoveToFolderModal } from './components/panels/MoveToFolderModal'
import { useI18n } from './i18n'
import { useLocaleStore } from './stores/localeStore'
import type { LocaleSnapshot } from '@shared/contracts'
import type { Folder, Page, WorkspaceSummary } from '@shared/domain'
import { Explorer } from './components/panels/Explorer'
import { LLMConfigPanel } from './components/editors/SettingsEditor/LLMConfigPanel'
import { TreeView } from './components/common/TreeView'
import { UserProfileCard } from './components/layout/ActivityBar/UserProfileCard'
import { useAccountStore } from './stores/accountStore'
import { WorkspaceCard } from './components/layout/ActivityBar/WorkspaceCard'
import { useWorkspaceStore } from './stores/workspaceStore'

function Fixture(): React.JSX.Element {
  const { language } = useI18n()
  return (
    <ConfigProvider locale={language === 'zh-CN' ? zhCN : enUS}>
      <App>
        <GeneralPanel />
        <Empty />
        <DateTimeText value={Date.now() - 86400000} tooltip={false} />
      </App>
    </ConfigProvider>
  )
}
const english: LocaleSnapshot = {
  preference: 'system',
  language: 'en-US',
  systemLanguage: 'en-US',
  revision: 0
}
beforeEach(() => {
  useLocaleStore.setState({ snapshot: null, saving: false })
  useLocaleStore.getState().accept(english)
  useAccountStore.getState().reset()
  useWorkspaceStore.getState().reset()
})

describe('默认账户名称', () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [
        { id: 'default', name: '默认账户', usesDefaultName: true, createdAt: 1 },
        { id: 'custom', name: '我的账户', usesDefaultName: false, createdAt: 2 }
      ],
      currentAccountId: 'default'
    })
  })

  it('账户卡片和已打开的切换列表随语言变化，自定义名称保留', async () => {
    render(
      <App>
        <UserProfileCard onClose={vi.fn()} />
      </App>
    )
    expect(screen.getByText('Default account')).toBeTruthy()
    expect(screen.queryByText('默认账户')).toBeNull()
    await act(async () =>
      useLocaleStore
        .getState()
        .accept({ ...english, preference: 'zh-CN', language: 'zh-CN', revision: 1 })
    )
    expect(screen.getByText('默认账户')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /切换账户/ }))
    expect(screen.getByText('默认账户')).toBeTruthy()
    expect(screen.getByText('我的账户')).toBeTruthy()
    await act(async () => useLocaleStore.getState().accept({ ...english, revision: 2 }))
    expect(screen.getByText('Default account')).toBeTruthy()
    expect(screen.getByText('我的账户')).toBeTruthy()
    expect(useAccountStore.getState().accounts[0].name).toBe('默认账户')
  })

  it('编辑显示当前语言，未修改名称时保存不固化默认名称', async () => {
    const command = vi.fn().mockResolvedValue(undefined)
    window.runtime = { command } as unknown as Window['runtime']
    const { container } = render(
      <App>
        <UserProfileCard onClose={vi.fn()} />
      </App>
    )
    fireEvent.click(container.querySelector('.ant-avatar')!)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Default account')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(command).toHaveBeenCalledWith(
      'account.update',
      { accountId: 'default', patch: { avatar: 'user' } },
      null
    )
    fireEvent.click(container.querySelector('.ant-avatar')!)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Personal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(command).toHaveBeenLastCalledWith(
      'account.update',
      { accountId: 'default', patch: { name: 'Personal', avatar: 'user' } },
      null
    )
  })

  it('手动设置的同名账户不会被翻译', () => {
    useAccountStore.setState({
      accounts: [{ id: 'custom', name: '默认账户', usesDefaultName: false, createdAt: 1 }],
      currentAccountId: 'custom'
    })
    render(
      <App>
        <UserProfileCard onClose={vi.fn()} />
      </App>
    )
    expect(screen.getByText('默认账户')).toBeTruthy()
    expect(screen.queryByText('Default account')).toBeNull()
  })
})

describe('默认工作区名称', () => {
  it.each(['default', 'custom'] as const)(
    '当前工作区为 %s 时，卡片和切换列表立即更新语言，自定义名称保留',
    async (currentWorkspaceId) => {
      const workspaces: WorkspaceSummary[] = [
        {
          id: 'default',
          name: '默认工作区',
          type: 'default',
          usesDefaultName: true,
          path: '/default'
        },
        {
          id: 'custom',
          name: '我的工作区',
          type: 'custom',
          usesDefaultName: false,
          path: '/custom'
        }
      ]
      useWorkspaceStore.setState({
        workspaces,
        currentWorkspaceId,
        currentWorkspace: workspaces.find((workspace) => workspace.id === currentWorkspaceId)
      })
      render(
        <App>
          <WorkspaceCard onClose={vi.fn()} />
        </App>
      )
      expect(screen.getByText('Default workspace')).toBeTruthy()
      expect(screen.queryByText('默认工作区')).toBeNull()
      expect(screen.getByText('我的工作区')).toBeTruthy()
      await act(async () =>
        useLocaleStore
          .getState()
          .accept({ ...english, preference: 'zh-CN', language: 'zh-CN', revision: 1 })
      )
      expect(screen.getByText('默认工作区')).toBeTruthy()
      expect(screen.queryByText('Default workspace')).toBeNull()
      expect(screen.getByText('我的工作区')).toBeTruthy()
      await act(async () => useLocaleStore.getState().accept({ ...english, revision: 2 }))
      expect(screen.getByText('Default workspace')).toBeTruthy()
      expect(useWorkspaceStore.getState().workspaces).toEqual(workspaces)
    }
  )

  it.each(['default', 'custom'] as const)('手动命名的 %s 工作区即使同名也保留原文', (type) => {
    const workspace: WorkspaceSummary = {
      id: 'named',
      name: '默认工作区',
      type,
      usesDefaultName: false,
      path: '/named'
    }
    useWorkspaceStore.setState({
      workspaces: [workspace],
      currentWorkspaceId: workspace.id,
      currentWorkspace: workspace
    })
    render(
      <App>
        <WorkspaceCard onClose={vi.fn()} />
      </App>
    )
    expect(screen.getByText('默认工作区')).toBeTruthy()
    expect(screen.queryByText('Default workspace')).toBeNull()
  })
})

describe('设置中的语言选择', () => {
  it.each([
    ['资源管理器', Explorer, '.explorer-toolbar'],
    ['模型配置树', LLMConfigPanel, '.config-tree-toolbar']
  ] as const)('%s 的新建文件夹菜单随语言切换', async (_, Component, toolbar) => {
    const { container } = render(
      <App>
        <Component />
      </App>
    )
    fireEvent.mouseEnter(container.querySelector(`${toolbar} .ant-dropdown-trigger`)!)
    // 先等待菜单打开，再按文本查询，避免轮询整页可访问名称时阻塞悬停计时器。
    const menu = within(await screen.findByRole('menu'))
    expect(menu.getByText('New folder')).toBeTruthy()
    await act(async () =>
      useLocaleStore
        .getState()
        .accept({ ...english, preference: 'zh-CN', language: 'zh-CN', revision: 1 })
    )
    expect(menu.getByText('新建文件夹')).toBeTruthy()
    expect(menu.queryByText('New folder')).toBeNull()
  })

  it.each(['context', 'more'])('通用树 %s 菜单打开期间切换语言，目录名称不变', async (trigger) => {
    const noop = (): void => undefined
    const { container } = render(
      <App>
        <TreeView<Page, Folder>
          items={[]}
          folders={[
            { id: 'folder', kind: 'folder', name: '我的目录', orderKey: 'a0', createdAt: 1 }
          ]}
          selectedId={null}
          onSelect={noop}
          itemIcon={null}
          getItemName={(item) => item.name}
          isItem={(item): item is Page => item.kind === 'page'}
          onMove={noop}
          updateItem={noop}
          deleteItem={noop}
          updateFolder={noop}
          deleteFolder={noop}
          toggleFolderExpanded={noop}
          onCreateSubFolder={noop}
        />
      </App>
    )
    if (trigger === 'context') fireEvent.contextMenu(screen.getByText('我的目录'))
    else fireEvent.click(container.querySelector('.tree-view-title-more')!)
    const menu = within(await screen.findByRole('menu'))
    expect(menu.getByText('New folder')).toBeTruthy()
    await act(async () =>
      useLocaleStore
        .getState()
        .accept({ ...english, preference: 'zh-CN', language: 'zh-CN', revision: 1 })
    )
    expect(menu.getByText('新建文件夹')).toBeTruthy()
    expect(menu.queryByText('New folder')).toBeNull()
    expect(menu.getByText('重命名')).toBeTruthy()
    expect(screen.getByText('我的目录')).toBeTruthy()
  })

  it('真实下拉菜单切换整套文案、组件默认文案、日期和文档语言', async () => {
    const command = vi
      .fn()
      .mockResolvedValue({ ...english, preference: 'zh-CN', language: 'zh-CN', revision: 1 })
    window.runtime = { command } as unknown as Window['runtime']
    render(<Fixture />)
    expect(screen.getByText('Font size')).toBeTruthy()
    expect(screen.getByText('No data', { selector: '.ant-empty-description' })).toBeTruthy()
    expect(screen.getByText('1 day ago')).toBeTruthy()
    fireEvent.mouseDown(screen.getByLabelText('Interface language', { selector: 'input' }))
    const chineseOption = await screen.findByText('简体中文')
    await act(async () => {
      fireEvent.click(chineseOption)
    })
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(command).toHaveBeenCalledWith('app.locale.set', { preference: 'zh-CN' }, null)
    expect(screen.getByText('字体大小')).toBeTruthy()
    expect(screen.getByText('暂无数据', { selector: '.ant-empty-description' })).toBeTruthy()
    expect(screen.getByText('1天前')).toBeTruthy()
    expect(screen.getByLabelText('界面语言', { selector: 'input' })).toBeTruthy()
  })

  it('已打开的树和弹窗刷新语言，保留用户输入的目录名', async () => {
    const folders = [
      { id: 'folder', name: '我的目录', orderKey: 'a0', kind: 'folder' as const, createdAt: 1 }
    ]
    render(
      <App>
        <MoveToFolderModal open folders={folders} onClose={vi.fn()} onConfirm={vi.fn()} />
      </App>
    )
    expect(screen.getByText('Root')).toBeTruthy()
    await act(async () =>
      useLocaleStore
        .getState()
        .accept({ ...english, preference: 'zh-CN', language: 'zh-CN', revision: 1 })
    )
    expect(screen.getByText('根目录')).toBeTruthy()
    expect(screen.getByText('我的目录')).toBeTruthy()
  })
})

import { HomeOutlined, MessageOutlined, SettingOutlined } from '@ant-design/icons'
import { registerTabType } from './utils/tabRegistry'
import type { Tab } from './types/type'
import { usePagesStore } from './stores/pagesStore'
import { WelcomePage } from './components/editors/WelcomePage'

// 注册 welcome 类型
registerTabType({
  type: 'welcome',
  icon: <HomeOutlined />,
  renderEditor: () => <WelcomePage />
})

// 注册 chat 类型
registerTabType({
  type: 'chat',
  icon: <MessageOutlined />,
  renderEditor: (tab) => <div>聊天编辑器: {tab.title}</div>,
  parseDataId: (tabId) => (tabId.startsWith('chat-') ? tabId.slice(5) : null),
  validateData: (dataId) => usePagesStore.getState().pages.some((p) => p.id === dataId),
  restoreTab: (dataId): Tab | null => {
    const page = usePagesStore.getState().pages.find((p) => p.id === dataId)
    if (!page) return null
    return {
      id: `chat-${dataId}`,
      type: 'chat',
      title: page.title,
      dataId
    }
  }
})

// 注册 settings 类型
registerTabType({
  type: 'settings',
  icon: <SettingOutlined />,
  renderEditor: () => <div>设置编辑器</div>
})

// 导出空对象以避免 TS6133 警告
export {}

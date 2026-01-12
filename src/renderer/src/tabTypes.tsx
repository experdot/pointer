import { HomeOutlined, MessageOutlined, SettingOutlined, ExportOutlined } from '@ant-design/icons'
import { v4 as uuidv4 } from 'uuid'
import { registerTabType } from './utils/tabRegistry'
import type { Tab } from './types/type'
import { usePagesStore } from './stores/pagesStore'
import { WelcomePage } from './components/editors/WelcomePage'
import { SettingsEditor } from './components/editors/SettingsEditor'
import { ChatEditor } from './components/editors/ChatEditor'
import { ExportEditor } from './components/editors/ExportEditor'
import * as pagesService from './services/pagesService'
import { openSettings } from './services/settingsService'
import type { ExportEditorContext } from './features/export/types'

// 注册 welcome 类型
registerTabType({
  type: 'welcome',
  icon: <HomeOutlined />,
  renderEditor: () => (
    <WelcomePage
      onNewChat={async () => {
        const page = await pagesService.createPage()
        pagesService.openPage(page.id)
      }}
      onOpenSettings={openSettings}
    />
  )
})

// 注册 chat 类型
registerTabType({
  type: 'chat',
  icon: <MessageOutlined />,
  renderEditor: (tab) => <ChatEditor pageId={tab.dataId!} />,
  validateData: (dataId) => usePagesStore.getState().pages.some((p) => p.id === dataId),
  restoreTab: (dataId): Tab | null => {
    const page = usePagesStore.getState().pages.find((p) => p.id === dataId)
    if (!page) return null
    return {
      id: uuidv4(),
      type: 'chat',
      title: page.name,
      dataId
    }
  }
})

// 注册 settings 类型
registerTabType({
  type: 'settings',
  icon: <SettingOutlined />,
  renderEditor: () => <SettingsEditor />
})

// 注册 export 类型
registerTabType({
  type: 'export',
  icon: <ExportOutlined />,
  renderEditor: (tab) => (
    <ExportEditor context={(tab as Tab & { context?: ExportEditorContext }).context} />
  )
})

// 导出空对象以避免 TS6133 警告
export {}

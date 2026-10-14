/**
 * 展示层持久化状态
 *
 * 内核把它当作不透明文档存储，不解释其中含义；
 * 类型定义放在此处是为了让渲染进程有唯一的形状来源。
 */

export type ActivityPanel = 'explorer' | 'search' | 'favorites'

export interface TabState {
  id: string
  type: string
  title: string
  dataId?: string
  closable?: boolean
  pinned?: boolean
  preview?: boolean
}

/** 页签在界面层的惯用名 */
export type Tab = TabState

export interface TabHistoryEntry {
  tabId: string
  type: string
  dataId?: string
}

export interface LayoutState {
  sidebarWidth: number
  sidebarVisible: boolean
  activePanel: ActivityPanel
}

export interface ViewState {
  tabs: TabState[]
  activeTabId: string | null
  history: TabHistoryEntry[]
  historyIndex: number
  layout: LayoutState
  /** 展开的文件夹 id 集合 */
  expandedFolderIds: string[]
  /** 设置面板中展开的配置文件夹 id 集合 */
  expandedConfigFolderIds: string[]
}

export function defaultViewState(): ViewState {
  return {
    tabs: [],
    activeTabId: null,
    history: [],
    historyIndex: -1,
    layout: { sidebarWidth: 260, sidebarVisible: true, activePanel: 'explorer' },
    expandedFolderIds: [],
    expandedConfigFolderIds: []
  }
}

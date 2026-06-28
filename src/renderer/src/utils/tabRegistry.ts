import type { ReactNode } from 'react'
import type { Tab } from '../types/type'

// 重新导出 Tab 类型
export type { Tab } from '../types/type'

// Tab 类型配置
export interface TabTypeConfig {
  type: string
  icon: ReactNode
  // 渲染编辑器内容
  renderEditor: (tab: Tab) => ReactNode
  // 验证关联数据是否存在
  validateData?: (dataId: string) => boolean
  // 恢复已关闭的 tab（用于历史导航）
  restoreTab?: (dataId: string) => Tab | null
}

// Tab 类型注册表
const tabTypeRegistry = new Map<string, TabTypeConfig>()

// 注册 tab 类型
export function registerTabType(config: TabTypeConfig): void {
  tabTypeRegistry.set(config.type, config)
}

// 获取 tab 类型配置
export function getTabTypeConfig(type: string): TabTypeConfig | undefined {
  return tabTypeRegistry.get(type)
}

// 获取所有已注册的 tab 类型
export function getAllTabTypes(): string[] {
  return Array.from(tabTypeRegistry.keys())
}

// 获取 tab 图标
export function getTabIcon(type: string): ReactNode {
  return tabTypeRegistry.get(type)?.icon ?? null
}

// 尝试恢复已关闭的 tab
export function tryRestoreTab(type: string, dataId?: string): Tab | null {
  const config = tabTypeRegistry.get(type)
  if (!config?.restoreTab || !dataId) {
    return null
  }
  return config.restoreTab(dataId)
}

// 清理无效的 tabs（返回有效的 tabs）
export function filterValidTabs(tabs: Tab[]): Tab[] {
  return tabs.filter((tab) => {
    const config = tabTypeRegistry.get(tab.type)
    if (!config?.validateData || !tab.dataId) {
      return true
    }
    return config.validateData(tab.dataId)
  })
}

// 渲染 tab 编辑器内容
export function renderTabEditor(tab: Tab): ReactNode {
  const config = tabTypeRegistry.get(tab.type)
  if (!config) {
    return null
  }
  return config.renderEditor(tab)
}

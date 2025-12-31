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
  // 从 tabId 解析关联数据 ID
  parseDataId?: (tabId: string) => string | null
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

// 从 tabId 解析数据 ID（遍历所有注册类型）
export function parseDataIdFromTabId(tabId: string): { type: string; dataId: string } | null {
  for (const [type, config] of tabTypeRegistry) {
    if (config.parseDataId) {
      const dataId = config.parseDataId(tabId)
      if (dataId) {
        return { type, dataId }
      }
    }
  }
  return null
}

// 验证 tabId 对应的数据是否有效
export function validateTabData(tabId: string): boolean {
  const parsed = parseDataIdFromTabId(tabId)
  if (!parsed) {
    // 没有关联数据的 tab（如 welcome, settings）始终有效
    return true
  }
  const config = tabTypeRegistry.get(parsed.type)
  if (!config?.validateData) {
    return true
  }
  return config.validateData(parsed.dataId)
}

// 尝试恢复已关闭的 tab
export function tryRestoreTab(tabId: string): Tab | null {
  const parsed = parseDataIdFromTabId(tabId)
  if (!parsed) {
    return null
  }
  const config = tabTypeRegistry.get(parsed.type)
  if (!config?.restoreTab) {
    return null
  }
  return config.restoreTab(parsed.dataId)
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

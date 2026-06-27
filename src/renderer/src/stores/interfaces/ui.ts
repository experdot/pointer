/**
 * UI Store 接口定义
 * 包含 Layout, Tab, Settings 等 UI 相关 Store 接口
 */

import type { IInitializable, IResettable } from './base'
import type { ActivityPanel } from '../../persistence/interfaces/userData'
import type {
  Tab,
  TabHistoryEntry,
  Settings,
  LLMConfig,
  ModelConfig,
  ConfigFolder
} from '../../types/type'

// ==================== Layout Store ====================

/**
 * 布局 Store 接口
 */
export interface ILayoutStore extends IInitializable, IResettable {
  // ==================== 状态 ====================

  readonly sidebarWidth: number
  readonly sidebarVisible: boolean
  readonly activePanel: ActivityPanel
  readonly isCompactMode: boolean
  readonly minSidebarWidth: number
  readonly maxSidebarWidth: number

  // ==================== 操作 ====================

  setSidebarWidth(width: number): void
  setSidebarVisible(visible: boolean): void
  toggleSidebar(): void
  setActivePanel(panel: ActivityPanel): void
  revealPanel(panel: ActivityPanel): void
  setCompactMode(isCompact: boolean): void
}

// ==================== Tab Store ====================

/**
 * 标签页 Store 接口
 */
export interface ITabStore extends IInitializable, IResettable {
  // ==================== 状态 ====================

  readonly tabs: Tab[]
  readonly activeTabId: string | null
  readonly history: TabHistoryEntry[]
  readonly historyIndex: number

  // ==================== Tab 基本操作 ====================

  /**
   * 打开标签页
   * @param tab 标签页配置
   * @param preview 是否为预览模式
   */
  openTab(tab: Tab, preview?: boolean): void

  /**
   * 关闭标签页
   */
  closeTab(tabId: string): void

  /**
   * 设置激活的标签页
   */
  setActiveTab(tabId: string): void

  /**
   * 激活下一个标签页
   */
  activateNextTab(): void

  /**
   * 激活上一个标签页
   */
  activatePrevTab(): void

  /**
   * 更新标签页标题
   */
  updateTabTitle(tabId: string, title: string): void

  // ==================== Tab 批量操作 ====================

  /**
   * 重新排序标签页
   */
  reorderTabs(fromIndex: number, toIndex: number): void

  /**
   * 切换标签页固定状态
   */
  togglePinTab(tabId: string): void

  /**
   * 关闭其他标签页
   */
  closeOtherTabs(tabId: string): void

  /**
   * 关闭右侧标签页
   */
  closeRightTabs(tabId: string): void

  /**
   * 关闭所有标签页
   */
  closeAllTabs(): void

  /**
   * 清理无效标签页
   */
  cleanupInvalidTabs(): void

  // ==================== 历史导航 ====================

  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  clearHistory(): void
  navigateToHistoryIndex(index: number): void

  // ==================== 预览模式 ====================

  /**
   * 将预览标签页转为常规标签页
   */
  keepTab(tabId: string): void
}

// ==================== Settings Store ====================

/**
 * 设置 Store 接口
 */
export interface ISettingsStore extends IInitializable, IResettable {
  // ==================== 状态 ====================

  readonly settings: Settings

  // ==================== 基础设置 ====================

  setFontSize(size: 'small' | 'medium' | 'large'): void
  setDefaultLLMId(id: string | undefined): void
  setDefaultModelConfigId(id: string | undefined): void
  setAutoCheckUpdate(enabled: boolean): void

  // ==================== LLM 配置 ====================

  addLLMConfig(config: LLMConfig): void
  updateLLMConfig(id: string, changes: Partial<LLMConfig>): void
  removeLLMConfig(id: string): void

  // ==================== LLM 文件夹 ====================

  addLLMConfigFolder(folder: ConfigFolder): void
  updateLLMConfigFolder(id: string, changes: Partial<ConfigFolder>): void
  removeLLMConfigFolder(id: string): void
  clearLLMConfigFolder(id: string): void

  // ==================== Model 配置 ====================

  addModelConfig(config: ModelConfig): void
  updateModelConfig(id: string, changes: Partial<ModelConfig>): void
  removeModelConfig(id: string): void

  // ==================== Model 文件夹 ====================

  addModelConfigFolder(folder: ConfigFolder): void
  updateModelConfigFolder(id: string, changes: Partial<ConfigFolder>): void
  removeModelConfigFolder(id: string): void
  clearModelConfigFolder(id: string): void

  // ==================== 批量更新 ====================

  batchUpdateLLMConfigs(updates: Array<{ id: string; changes: Partial<LLMConfig> }>): void
  batchUpdateLLMConfigFolders(updates: Array<{ id: string; changes: Partial<ConfigFolder> }>): void
  batchUpdateModelConfigs(updates: Array<{ id: string; changes: Partial<ModelConfig> }>): void
  batchUpdateModelConfigFolders(
    updates: Array<{ id: string; changes: Partial<ConfigFolder> }>
  ): void
}

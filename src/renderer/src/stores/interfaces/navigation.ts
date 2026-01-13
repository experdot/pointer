/**
 * 导航 Store 接口定义
 * 从 messagesStore 拆分出来，专门管理消息导航状态
 */

/**
 * 导航请求
 */
export interface NavigationRequest {
  version: number
  target: {
    pageId: string
    messageId: string
    instant?: boolean
  }
  timestamp: number
}

/**
 * 相对导航请求
 */
export interface RelativeNavigationRequest {
  version: number
  direction: 'prev' | 'next'
  pageId: string
  timestamp: number
}

/**
 * 导航 Store 接口
 */
export interface INavigationStore {
  // ==================== 状态 ====================

  readonly pendingNavigation: NavigationRequest | null
  readonly pendingRelativeNavigation: RelativeNavigationRequest | null

  // ==================== 操作 ====================

  /**
   * 请求导航到指定消息
   */
  requestNavigation(request: NavigationRequest): void

  /**
   * 请求相对导航（上一条/下一条）
   */
  requestRelativeNavigation(request: RelativeNavigationRequest): void

  /**
   * 清除导航请求
   */
  clearNavigation(version: number): void

  /**
   * 清除相对导航请求
   */
  clearRelativeNavigation(version: number): void
}

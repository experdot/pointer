/**
 * Store 注册表
 * 提供所有 Store 的统一访问入口，实现依赖倒置
 */

import type { IStoreRegistry } from './interfaces'

// ==================== Registry 实例 ====================

let registry: IStoreRegistry | null = null

/**
 * 获取 Store 注册表
 * @throws 如果注册表未初始化则抛出错误
 */
export function getStoreRegistry(): IStoreRegistry {
  if (!registry) {
    throw new Error('Store registry not initialized. Call initStoreRegistry first.')
  }
  return registry
}

/**
 * 初始化 Store 注册表
 * 应在应用启动时调用一次
 */
export function initStoreRegistry(storeRegistry: IStoreRegistry): void {
  registry = storeRegistry
}

/**
 * 重置 Store 注册表（用于测试）
 */
export function resetStoreRegistry(): void {
  registry = null
}

// ==================== 便捷访问器 ====================

/**
 * Store 便捷访问对象
 * 使用 getter 实现延迟访问，确保在注册表初始化后才能使用
 *
 * @example
 * import { stores } from '@/stores/registry'
 *
 * // 在 Service 中使用
 * const page = stores.page.getById(id)
 * await stores.page.create({ name: '新页面' })
 *
 * // 解构使用
 * const { page, folder, message } = stores
 */
export const stores = {
  get page() {
    return getStoreRegistry().page
  },
  get folder() {
    return getStoreRegistry().folder
  },
  get message() {
    return getStoreRegistry().message
  },
  get account() {
    return getStoreRegistry().account
  },
  get layout() {
    return getStoreRegistry().layout
  },
  get tab() {
    return getStoreRegistry().tab
  },
  get settings() {
    return getStoreRegistry().settings
  },
  get navigation() {
    return getStoreRegistry().navigation
  },
  get workspace() {
    return getStoreRegistry().workspace
  }
} as const

// ==================== 类型导出 ====================

export type { IStoreRegistry }

import { Page } from '../../types/type'
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from './constants'

// 根据ID更新页面
export const updatePageById = (pages: Page[], chatId: string, updates: Partial<Page>): Page[] =>
  pages.map((page) => (page.id === chatId ? { ...page, ...updates, updatedAt: Date.now() } : page))

// 从数组中移除指定ID的项
export const removeFromArray = <T extends { id: string }>(array: T[], id: string): T[] =>
  array.filter((item) => item.id !== id)

// 约束侧边栏宽度
export const constrainSidebarWidth = (width: number): number =>
  Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width))

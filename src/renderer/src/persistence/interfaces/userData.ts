/**
 * User data persistence interfaces and types
 * Operates on per-account database (pointer-{accountId})
 */

import type {
  ChatMessage,
  Topic,
  PageFolder,
  Settings,
  Tab,
  TabHistoryEntry
} from '../../types/type'
import type { IRepository, ISingletonRepository, IKeyedRepository } from './base'

// ==================== Record Types ====================

/**
 * Page record (without messages)
 */
export interface PageRecord {
  id: string
  type: 'item'
  name: string
  parentFolderId?: string
  order?: number
  starred?: boolean
  createdAt: number
  updatedAt?: number
}

/**
 * Messages record (messages + tree navigation state for a page)
 */
export interface MessagesRecord {
  pageId: string
  messages: ChatMessage[]
  topics: Topic[]
  rootMessageId?: string
  leafMessageId?: string
  selectedMessageId?: string
}

/**
 * Activity panel type
 */
export type ActivityPanel = 'explorer' | 'search' | 'favorites' | 'tasks'

/**
 * Layout record
 */
export interface LayoutRecord {
  sidebarWidth: number
  sidebarVisible: boolean
  activePanel: ActivityPanel
}

/**
 * Tabs record
 */
export interface TabsRecord {
  tabs: Tab[]
  activeTabId: string | null
  history: TabHistoryEntry[]
  historyIndex: number
}

/**
 * Queue item
 */
export interface QueueItem {
  id: string
  content: string
  order: number
  createdAt: number
}

/**
 * Message queue record (per page)
 */
export interface MessageQueueRecord {
  pageId: string
  items: QueueItem[]
  paused: boolean
}

// ==================== Repository Interfaces ====================

/**
 * Page repository interface
 * Extends base repository with cascade delete operations
 */
export interface IPageRepository extends IRepository<PageRecord> {
  /**
   * Delete page with associated messages
   */
  deleteWithMessages(id: string): Promise<void>

  /**
   * Batch delete pages with associated messages
   */
  deleteWithMessagesBatch(ids: string[]): Promise<void>

  /**
   * Clear all pages and their messages
   */
  clearAllWithMessages(): Promise<void>
}

/**
 * Folder repository interface
 */
export interface IFolderRepository extends IRepository<PageFolder> {}

/**
 * Messages repository interface
 * Keyed by pageId
 */
export interface IMessagesRepository extends IKeyedRepository<MessagesRecord> {
  /**
   * Batch put messages records
   */
  putBatch(records: MessagesRecord[]): Promise<void>
}

/**
 * Settings repository interface
 */
export interface ISettingsRepository extends ISingletonRepository<Settings> {}

/**
 * Layout repository interface
 */
export interface ILayoutRepository extends ISingletonRepository<LayoutRecord> {}

/**
 * Tabs repository interface
 */
export interface ITabsRepository extends ISingletonRepository<TabsRecord> {}

/**
 * Message queue repository interface
 * Keyed by pageId
 */
export interface IMessageQueueRepository extends IKeyedRepository<MessageQueueRecord> {}

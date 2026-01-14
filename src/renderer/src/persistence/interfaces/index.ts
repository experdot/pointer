/**
 * Persistence interfaces unified export
 */

// Base interfaces
export type { IRepository, ISingletonRepository, IKeyedRepository, IDatabaseManager } from './base'

// Account interfaces
export type { IAccountRepository } from './accounts'

// User data interfaces and types
export type {
  PageRecord,
  MessagesRecord,
  LayoutRecord,
  TabsRecord,
  QueueItem,
  MessageQueueRecord,
  ActivityPanel,
  IPageRepository,
  IFolderRepository,
  IMessagesRepository,
  ISettingsRepository,
  ILayoutRepository,
  ITabsRepository,
  IMessageQueueRepository
} from './userData'

// Re-import for IPersistenceRegistry definition
import type { IDatabaseManager } from './base'
import type { IAccountRepository } from './accounts'
import type {
  IPageRepository,
  IFolderRepository,
  IMessagesRepository,
  ISettingsRepository,
  ILayoutRepository,
  ITabsRepository,
  IMessageQueueRepository
} from './userData'

/**
 * Persistence registry interface
 * Central access point for all repositories
 */
export interface IPersistenceRegistry {
  /** Database management operations */
  readonly database: IDatabaseManager

  /** Account repository (independent database) */
  readonly accounts: IAccountRepository

  /** Page repository */
  readonly pages: IPageRepository

  /** Folder repository */
  readonly folders: IFolderRepository

  /** Messages repository */
  readonly messages: IMessagesRepository

  /** Settings repository */
  readonly settings: ISettingsRepository

  /** Layout repository */
  readonly layout: ILayoutRepository

  /** Tabs repository */
  readonly tabs: ITabsRepository

  /** Message queue repository */
  readonly messageQueue: IMessageQueueRepository
}

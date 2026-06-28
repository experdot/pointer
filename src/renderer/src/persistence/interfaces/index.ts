/**
 * Persistence interfaces unified export
 */

// Base interfaces
export type {
  IRepository,
  ISingletonRepository,
  IKeyedRepository,
  IDatabaseManager,
  AccountScope,
  WorkspaceScope,
  PersistenceContext,
  ContextCommitInput
} from './base'

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

// Workspace interfaces
export type { IWorkspaceRepository, WorkspaceRepairResult } from './workspace'

// Re-import for IPersistenceRegistry definition
import type { IDatabaseManager, AccountScope, WorkspaceScope } from './base'
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
import type { IWorkspaceRepository } from './workspace'

export interface IAccountScopedPersistence {
  readonly workspaces: IWorkspaceRepository
  readonly settings: ISettingsRepository
  readonly layout: ILayoutRepository
}

export interface IWorkspaceScopedPersistence {
  readonly pages: IPageRepository
  readonly folders: IFolderRepository
  readonly messages: IMessagesRepository
  readonly tabs: ITabsRepository
  readonly messageQueue: IMessageQueueRepository
}

/**
 * Persistence registry interface
 * Central access point for all repositories
 */
export interface IPersistenceRegistry {
  /** Database management operations */
  readonly database: IDatabaseManager

  /** Account repository (independent database) */
  readonly accounts: IAccountRepository

  /** Explicit account-scoped repositories */
  account(scope: AccountScope | string): IAccountScopedPersistence

  /** Explicit workspace-scoped repositories */
  workspace(scope: WorkspaceScope): IWorkspaceScopedPersistence

  /** Workspace repository (account-level) */
  readonly workspaces: IWorkspaceRepository

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

/**
 * File System Persistence Implementation
 */

import type { IPersistenceRegistry, IDatabaseManager } from '../../interfaces'
import type { IAccountRepository } from '../../interfaces/accounts'
import type { IWorkspaceRepository } from '../../interfaces/workspace'
import type {
  IPageRepository,
  IFolderRepository,
  IMessagesRepository,
  ISettingsRepository,
  ILayoutRepository,
  ITabsRepository,
  IMessageQueueRepository
} from '../../interfaces/userData'
import {
  initAppDataPath,
  setCurrentAccount,
  setCurrentWorkspace,
  getAccountPath,
  deleteFile
} from './core'
import { createAccountRepository } from './accountsRepository'
import { createWorkspaceRepository } from './workspaceRepository'
import { createPageRepository, invalidatePageCache } from './pagesRepository'
import { createFolderRepository } from './foldersRepository'
import { createMessagesRepository } from './messagesRepository'
import { createSettingsRepository } from './settingsRepository'
import { createLayoutRepository } from './layoutRepository'
import { createTabsRepository } from './tabsRepository'
import { createMessageQueueRepository } from './messageQueueRepository'
import { clearAllLocks } from './writeLock'

// ==================== Repository Cache ====================

// Module-level cache for repository singletons
let cachedAccountsRepo: IAccountRepository | null = null
let cachedWorkspacesRepo: IWorkspaceRepository | null = null
let cachedPagesRepo: IPageRepository | null = null
let cachedFoldersRepo: IFolderRepository | null = null
let cachedMessagesRepo: IMessagesRepository | null = null
let cachedSettingsRepo: ISettingsRepository | null = null
let cachedLayoutRepo: ILayoutRepository | null = null
let cachedTabsRepo: ITabsRepository | null = null
let cachedMessageQueueRepo: IMessageQueueRepository | null = null

// Lazy getters for repositories
function getAccountsRepo(): IAccountRepository {
  if (!cachedAccountsRepo) {
    cachedAccountsRepo = createAccountRepository()
  }
  return cachedAccountsRepo
}

function getWorkspacesRepo(): IWorkspaceRepository {
  if (!cachedWorkspacesRepo) {
    cachedWorkspacesRepo = createWorkspaceRepository()
  }
  return cachedWorkspacesRepo
}

function getPagesRepo(): IPageRepository {
  if (!cachedPagesRepo) {
    cachedPagesRepo = createPageRepository()
  }
  return cachedPagesRepo
}

function getFoldersRepo(): IFolderRepository {
  if (!cachedFoldersRepo) {
    cachedFoldersRepo = createFolderRepository()
  }
  return cachedFoldersRepo
}

function getMessagesRepo(): IMessagesRepository {
  if (!cachedMessagesRepo) {
    cachedMessagesRepo = createMessagesRepository()
  }
  return cachedMessagesRepo
}

function getSettingsRepo(): ISettingsRepository {
  if (!cachedSettingsRepo) {
    cachedSettingsRepo = createSettingsRepository()
  }
  return cachedSettingsRepo
}

function getLayoutRepo(): ILayoutRepository {
  if (!cachedLayoutRepo) {
    cachedLayoutRepo = createLayoutRepository()
  }
  return cachedLayoutRepo
}

function getTabsRepo(): ITabsRepository {
  if (!cachedTabsRepo) {
    cachedTabsRepo = createTabsRepository()
  }
  return cachedTabsRepo
}

function getMessageQueueRepo(): IMessageQueueRepository {
  if (!cachedMessageQueueRepo) {
    cachedMessageQueueRepo = createMessageQueueRepository()
  }
  return cachedMessageQueueRepo
}

/**
 * Reset workspace-level repository caches
 * Called when workspace changes
 */
function resetWorkspaceRepositoryCache(): void {
  cachedPagesRepo = null
  cachedFoldersRepo = null
  cachedMessagesRepo = null
  cachedSettingsRepo = null
  cachedLayoutRepo = null
  cachedTabsRepo = null
  cachedMessageQueueRepo = null
  // Clear page file cache
  invalidatePageCache()
  // Clear write locks
  clearAllLocks()
}

/**
 * Reset all repository caches
 * Called when account changes
 */
function resetAllRepositoryCache(): void {
  cachedAccountsRepo = null
  cachedWorkspacesRepo = null
  resetWorkspaceRepositoryCache()
}

/**
 * Create File System persistence registry
 */
export function createFileSystemPersistence(): IPersistenceRegistry {
  const databaseManager: IDatabaseManager = {
    async init(): Promise<void> {
      await initAppDataPath()
    },

    setAccount(accountId: string): void {
      setCurrentAccount(accountId)
      // Reset all caches when account changes
      resetAllRepositoryCache()
    },

    setWorkspace(workspacePath: string): void {
      setCurrentWorkspace(workspacePath)
      // Reset workspace-level caches when workspace changes
      resetWorkspaceRepositoryCache()
    },

    async deleteAccountData(accountId: string): Promise<void> {
      try {
        await deleteFile(getAccountPath(accountId), { recursive: true })
      } catch {
        // Ignore if directory doesn't exist
      }
    }
  }

  // Return registry with lazy-loaded repository getters
  return {
    database: databaseManager,
    get accounts() {
      return getAccountsRepo()
    },
    get workspaces() {
      return getWorkspacesRepo()
    },
    get pages() {
      return getPagesRepo()
    },
    get folders() {
      return getFoldersRepo()
    },
    get messages() {
      return getMessagesRepo()
    },
    get settings() {
      return getSettingsRepo()
    },
    get layout() {
      return getLayoutRepo()
    },
    get tabs() {
      return getTabsRepo()
    },
    get messageQueue() {
      return getMessageQueueRepo()
    }
  }
}

/**
 * Export reset function for external use (e.g., workspace switching)
 */
export { resetWorkspaceRepositoryCache, resetAllRepositoryCache }

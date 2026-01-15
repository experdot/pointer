/**
 * File System Persistence Implementation
 */

import type { IPersistenceRegistry, IDatabaseManager } from '../../interfaces'
import {
  initAppDataPath,
  setCurrentAccount,
  setCurrentWorkspace,
  getAccountPath,
  deleteFile
} from './core'
import { createAccountRepository } from './accountsRepository'
import { createWorkspaceRepository } from './workspaceRepository'
import { createPageRepository } from './pagesRepository'
import { createFolderRepository } from './foldersRepository'
import { createMessagesRepository } from './messagesRepository'
import { createSettingsRepository } from './settingsRepository'
import { createLayoutRepository } from './layoutRepository'
import { createTabsRepository } from './tabsRepository'
import { createMessageQueueRepository } from './messageQueueRepository'

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
    },

    setWorkspace(workspacePath: string): void {
      setCurrentWorkspace(workspacePath)
    },

    async deleteAccountData(accountId: string): Promise<void> {
      try {
        await deleteFile(getAccountPath(accountId), { recursive: true })
      } catch {
        // Ignore if directory doesn't exist
      }
    }
  }

  return {
    database: databaseManager,
    accounts: createAccountRepository(),
    workspaces: createWorkspaceRepository(),
    pages: createPageRepository(),
    folders: createFolderRepository(),
    messages: createMessagesRepository(),
    settings: createSettingsRepository(),
    layout: createLayoutRepository(),
    tabs: createTabsRepository(),
    messageQueue: createMessageQueueRepository()
  }
}

/**
 * IndexedDB Persistence Implementation
 */

import type { IPersistenceRegistry, IDatabaseManager } from '../../interfaces'
import { setUserDatabaseName, deleteUserDatabase } from './core'
import { createAccountRepository } from './accountsRepository'
import { createPageRepository } from './pagesRepository'
import { createFolderRepository } from './foldersRepository'
import { createMessagesRepository } from './messagesRepository'
import { createSettingsRepository } from './settingsRepository'
import { createLayoutRepository } from './layoutRepository'
import { createTabsRepository } from './tabsRepository'
import { createMessageQueueRepository } from './messageQueueRepository'

/**
 * Create IndexedDB persistence registry
 */
export function createIndexedDBPersistence(): IPersistenceRegistry {
  const databaseManager: IDatabaseManager = {
    setDatabase: setUserDatabaseName,
    deleteDatabase: deleteUserDatabase
  }

  return {
    database: databaseManager,
    accounts: createAccountRepository(),
    pages: createPageRepository(),
    folders: createFolderRepository(),
    messages: createMessagesRepository(),
    settings: createSettingsRepository(),
    layout: createLayoutRepository(),
    tabs: createTabsRepository(),
    messageQueue: createMessageQueueRepository()
  }
}

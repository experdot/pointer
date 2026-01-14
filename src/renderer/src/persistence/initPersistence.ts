/**
 * Persistence initialization
 * Called at application startup to initialize the persistence registry
 */

import { initPersistenceRegistry } from './registry'
import { createIndexedDBPersistence } from './implementations/indexeddb'

/**
 * Initialize persistence layer
 * Must be called once at application startup, BEFORE initStores()
 */
export function initPersistence(): void {
  const persistence = createIndexedDBPersistence()
  initPersistenceRegistry(persistence)
}

/**
 * Persistence initialization
 * Called at application startup to initialize the persistence registry
 */

import { initPersistenceRegistry } from './registry'
import { createFileSystemPersistence } from './implementations/filesystem'

/**
 * Initialize persistence layer
 * Must be called once at application startup, BEFORE initStores()
 */
export function initPersistence(): void {
  const persistence = createFileSystemPersistence()
  initPersistenceRegistry(persistence)
}

/**
 * Persistence Registry
 * Provides unified access point for all persistence operations
 * Mirrors the pattern from stores/registry.ts
 */

import type { IPersistenceRegistry } from './interfaces'

// ==================== Registry Instance ====================

let registry: IPersistenceRegistry | null = null

/**
 * Get persistence registry
 * @throws If registry not initialized
 */
export function getPersistenceRegistry(): IPersistenceRegistry {
  if (!registry) {
    throw new Error('Persistence registry not initialized. Call initPersistenceRegistry first.')
  }
  return registry
}

/**
 * Initialize persistence registry
 * Should be called once at application startup
 */
export function initPersistenceRegistry(persistenceRegistry: IPersistenceRegistry): void {
  registry = persistenceRegistry
}

/**
 * Reset persistence registry (for testing)
 */
export function resetPersistenceRegistry(): void {
  registry = null
}

// ==================== Convenience Accessor ====================

/**
 * Persistence convenience accessor object
 * Uses getters for lazy access, ensuring registry is initialized before use
 *
 * @example
 * import { persistence } from '@renderer/persistence/registry'
 *
 * // In a Store
 * const pages = await persistence.pages.getAll()
 * await persistence.pages.put(page)
 */
export const persistence = {
  get database() {
    return getPersistenceRegistry().database
  },
  get accounts() {
    return getPersistenceRegistry().accounts
  },
  get workspaces() {
    return getPersistenceRegistry().workspaces
  },
  get pages() {
    return getPersistenceRegistry().pages
  },
  get folders() {
    return getPersistenceRegistry().folders
  },
  get messages() {
    return getPersistenceRegistry().messages
  },
  get settings() {
    return getPersistenceRegistry().settings
  },
  get layout() {
    return getPersistenceRegistry().layout
  },
  get tabs() {
    return getPersistenceRegistry().tabs
  },
  get messageQueue() {
    return getPersistenceRegistry().messageQueue
  }
} as const

// ==================== Type Export ====================

export type { IPersistenceRegistry }

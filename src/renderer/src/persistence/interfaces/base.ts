/**
 * Persistence layer base interfaces
 */

/**
 * Standard CRUD repository interface
 * For entities with id-based storage (pages, folders, accounts)
 *
 * @template T Entity type
 * @template TKey Key type (default: string)
 */
export interface IRepository<T, TKey = string> {
  getAll(): Promise<T[]>
  getById(id: TKey): Promise<T | undefined>
  put(item: T): Promise<void>
  putBatch(items: T[]): Promise<void>
  delete(id: TKey): Promise<void>
  deleteBatch(ids: TKey[]): Promise<void>
  clear(): Promise<void>
}

/**
 * Singleton value repository interface
 * For single-record storage (settings, layout, tabs)
 *
 * @template T Value type
 */
export interface ISingletonRepository<T> {
  get(): Promise<T | undefined>
  put(value: T): Promise<void>
  clear(): Promise<void>
}

/**
 * Keyed repository interface
 * For key-value storage where key is not part of the value (messages by pageId)
 *
 * @template T Value type
 * @template TKey Key type (default: string)
 */
export interface IKeyedRepository<T, TKey = string> {
  get(key: TKey): Promise<T | undefined>
  put(key: TKey, value: T): Promise<void>
  delete(key: TKey): Promise<void>
  getAll(): Promise<T[]>
}

/**
 * Database manager interface
 * For database-level operations (switching accounts, deleting databases)
 */
export interface IDatabaseManager {
  setDatabase(name: string): void
  deleteDatabase(name: string): Promise<void>
}

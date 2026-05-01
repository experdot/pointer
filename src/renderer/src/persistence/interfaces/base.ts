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
 * For database-level operations (switching accounts, workspaces, deleting databases)
 */
export interface IDatabaseManager {
  /** Initialize the persistence layer */
  init(): Promise<void>
  /** Set current account (switches account-level storage) */
  setAccount(accountId: string): Promise<void>
  /** Set current workspace path (switches workspace-level storage) */
  setWorkspace(workspacePath: string): Promise<void>
  /** Synchronize main-process access roots for workspaces */
  syncWorkspaceAccess(
    currentWorkspacePath: string | null,
    approvedWorkspacePaths: string[]
  ): Promise<void>
  /** Allow a specific workspace path before it is added to the workspace list */
  approveWorkspacePath(workspacePath: string): Promise<void>
  /** Delete account data */
  deleteAccountData(accountId: string): Promise<void>
}

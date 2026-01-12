import type {
  ChatMessage,
  Topic,
  PageFolder,
  Settings,
  Tab,
  TabHistoryEntry,
  Account
} from '../types/type'

const DB_VERSION = 1
const STORES = {
  pages: 'pages',
  folders: 'folders',
  messages: 'messages',
  settings: 'settings',
  layout: 'layout',
  tabs: 'tabs',
  messageQueue: 'messageQueue'
} as const

type StoreName = (typeof STORES)[keyof typeof STORES]

// ==================== 通用事务执行器 ====================

/**
 * 执行单个 IDBRequest 操作并返回 Promise
 */
function execRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * 执行事务级别操作（用于批量操作或多 store 操作）
 */
function execTransaction(tx: IDBTransaction, operations: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => resolve()
    operations()
  })
}

/**
 * 通用的单记录读取
 */
async function dbGet<T>(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string,
  key: IDBValidKey,
  transform?: (result: unknown) => T | undefined
): Promise<T | undefined> {
  const db = await getDbFn()
  const tx = db.transaction(storeName, 'readonly')
  const result = await execRequest(tx.objectStore(storeName).get(key))
  return transform ? transform(result) : (result as T | undefined)
}

/**
 * 通用的单记录写入
 */
async function dbPut<T>(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string,
  value: T
): Promise<void> {
  const db = await getDbFn()
  const tx = db.transaction(storeName, 'readwrite')
  await execRequest(tx.objectStore(storeName).put(value))
}

/**
 * 通用的单记录删除
 */
async function dbDelete(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string,
  key: IDBValidKey
): Promise<void> {
  const db = await getDbFn()
  const tx = db.transaction(storeName, 'readwrite')
  await execRequest(tx.objectStore(storeName).delete(key))
}

/**
 * 通用的获取所有记录
 */
async function dbGetAll<T>(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string,
  transform?: (results: unknown[]) => T[]
): Promise<T[]> {
  const db = await getDbFn()
  const tx = db.transaction(storeName, 'readonly')
  const results = await execRequest(tx.objectStore(storeName).getAll())
  return transform ? transform(results ?? []) : ((results ?? []) as T[])
}

/**
 * 通用的批量写入
 */
async function dbPutBatch<T>(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string,
  items: T[]
): Promise<void> {
  if (items.length === 0) return
  const db = await getDbFn()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  await execTransaction(tx, () => {
    for (const item of items) {
      store.put(item)
    }
  })
}

/**
 * 通用的批量删除
 */
async function dbDeleteBatch(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string | string[],
  ids: IDBValidKey[]
): Promise<void> {
  if (ids.length === 0) return
  const db = await getDbFn()
  const storeNames = Array.isArray(storeName) ? storeName : [storeName]
  const tx = db.transaction(storeNames, 'readwrite')
  await execTransaction(tx, () => {
    for (const name of storeNames) {
      const store = tx.objectStore(name)
      for (const id of ids) {
        store.delete(id)
      }
    }
  })
}

/**
 * 通用的清空 store
 */
async function dbClear(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string | string[]
): Promise<void> {
  const db = await getDbFn()
  const storeNames = Array.isArray(storeName) ? storeName : [storeName]
  const tx = db.transaction(storeNames, 'readwrite')
  await execTransaction(tx, () => {
    for (const name of storeNames) {
      tx.objectStore(name).clear()
    }
  })
}

// ==================== 账户数据库（独立） ====================

const ACCOUNTS_DB_NAME = 'pointer-accounts'
let accountsDbInstance: IDBDatabase | null = null

function getAccountsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (accountsDbInstance) {
      resolve(accountsDbInstance)
      return
    }

    const request = indexedDB.open(ACCOUNTS_DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      accountsDbInstance = request.result
      resolve(accountsDbInstance)
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }
  })
}

export const getAllAccounts = (): Promise<Account[]> => dbGetAll<Account>(getAccountsDB, 'accounts')

export const putAccount = (account: Account): Promise<void> =>
  dbPut(getAccountsDB, 'accounts', account)

export const deleteAccount = (id: string): Promise<void> => dbDelete(getAccountsDB, 'accounts', id)

export async function getCurrentAccountId(): Promise<string | null> {
  const result = await dbGet<{ value?: string | null }>(getAccountsDB, 'meta', 'currentAccountId')
  return result?.value ?? null
}

export const setCurrentAccountId = (id: string | null): Promise<void> =>
  dbPut(getAccountsDB, 'meta', { key: 'currentAccountId', value: id })

// ==================== 用户数据库（按账户隔离） ====================

let currentDbName = 'pointer-default'
let dbInstance: IDBDatabase | null = null

// 页面记录（不含消息）
export interface PageRecord {
  id: string
  type: 'item'
  name: string
  parentFolderId?: string
  order?: number
  pinned?: boolean
  starred?: boolean
  createdAt: number
  updatedAt?: number
}

// 消息记录
export interface MessagesRecord {
  pageId: string
  messages: ChatMessage[]
  topics: Topic[]
  rootMessageId?: string
  leafMessageId?: string
  selectedMessageId?: string
}

// 获取数据库连接
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance && dbInstance.name === currentDbName) {
      resolve(dbInstance)
      return
    }

    if (dbInstance) {
      dbInstance.close()
      dbInstance = null
    }

    const request = indexedDB.open(currentDbName, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      dbInstance = request.result
      dbInstance.onversionchange = () => {
        dbInstance?.close()
        dbInstance = null
      }
      dbInstance.onclose = () => {
        dbInstance = null
      }
      resolve(dbInstance)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      const storeConfigs: Array<{ name: StoreName; keyPath: string }> = [
        { name: STORES.pages, keyPath: 'id' },
        { name: STORES.folders, keyPath: 'id' },
        { name: STORES.messages, keyPath: 'pageId' },
        { name: STORES.settings, keyPath: 'id' },
        { name: STORES.layout, keyPath: 'id' },
        { name: STORES.tabs, keyPath: 'id' },
        { name: STORES.messageQueue, keyPath: 'id' }
      ]
      for (const { name, keyPath } of storeConfigs) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath })
        }
      }
    }
  })
}

// 设置数据库名称（账户切换）
export function setDatabaseName(accountId: string): void {
  currentDbName = `pointer-${accountId}`
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

// 删除数据库
export function deleteDatabase(accountId: string): Promise<void> {
  const dbName = `pointer-${accountId}`
  return new Promise((resolve, reject) => {
    if (dbInstance && currentDbName === dbName) {
      dbInstance.close()
      dbInstance = null
    }
    const request = indexedDB.deleteDatabase(dbName)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ==================== Pages ====================

export const getAllPages = (): Promise<PageRecord[]> => dbGetAll<PageRecord>(getDB, STORES.pages)

export const getPage = (id: string): Promise<PageRecord | undefined> =>
  dbGet<PageRecord>(getDB, STORES.pages, id)

export const putPage = (page: PageRecord): Promise<void> => dbPut(getDB, STORES.pages, page)

export const putPagesBatch = (pages: PageRecord[]): Promise<void> =>
  dbPutBatch(getDB, STORES.pages, pages)

export async function deletePage(id: string): Promise<void> {
  await dbDeleteBatch(getDB, [STORES.pages, STORES.messages], [id])
}

export async function deletePagesBatch(ids: string[]): Promise<void> {
  await dbDeleteBatch(getDB, [STORES.pages, STORES.messages], ids)
}

export const clearAllPages = (): Promise<void> => dbClear(getDB, [STORES.pages, STORES.messages])

// ==================== Folders ====================

export const getAllFolders = (): Promise<PageFolder[]> =>
  dbGetAll<PageFolder>(getDB, STORES.folders)

export const putFolder = (folder: PageFolder): Promise<void> => dbPut(getDB, STORES.folders, folder)

export const deleteFolder = (id: string): Promise<void> => dbDelete(getDB, STORES.folders, id)

export const deleteFoldersBatch = (ids: string[]): Promise<void> =>
  dbDeleteBatch(getDB, STORES.folders, ids)

export const clearAllFolders = (): Promise<void> => dbClear(getDB, STORES.folders)

// ==================== Messages ====================

export const getMessages = (pageId: string): Promise<MessagesRecord | undefined> =>
  dbGet<MessagesRecord>(getDB, STORES.messages, pageId)

export const putMessages = (record: MessagesRecord): Promise<void> =>
  dbPut(getDB, STORES.messages, record)

export const putMessagesBatch = (records: MessagesRecord[]): Promise<void> =>
  dbPutBatch(getDB, STORES.messages, records)

export const deleteMessages = (pageId: string): Promise<void> =>
  dbDelete(getDB, STORES.messages, pageId)

// ==================== Settings ====================

export const getSettings = (): Promise<Settings | undefined> =>
  dbGet<Settings>(
    getDB,
    STORES.settings,
    'settings',
    (r) => (r as { data?: Settings } | undefined)?.data
  )

export const putSettings = (settings: Settings): Promise<void> =>
  dbPut(getDB, STORES.settings, { id: 'settings', data: settings })

export const clearSettings = (): Promise<void> => dbClear(getDB, STORES.settings)

// ==================== Layout ====================

export type ActivityPanel = 'explorer' | 'search' | 'favorites' | 'tasks'

export interface LayoutRecord {
  sidebarWidth: number
  sidebarVisible: boolean
  activePanel: ActivityPanel
}

export const getLayout = (): Promise<LayoutRecord | undefined> =>
  dbGet<LayoutRecord>(
    getDB,
    STORES.layout,
    'layout',
    (r) => (r as { data?: LayoutRecord } | undefined)?.data
  )

export const putLayout = (layout: LayoutRecord): Promise<void> =>
  dbPut(getDB, STORES.layout, { id: 'layout', data: layout })

export const clearLayout = (): Promise<void> => dbClear(getDB, STORES.layout)

// ==================== Tabs ====================

export interface TabsRecord {
  tabs: Tab[]
  activeTabId: string | null
  history: TabHistoryEntry[]
  historyIndex: number
}

export const getTabs = (): Promise<TabsRecord | undefined> =>
  dbGet<TabsRecord>(
    getDB,
    STORES.tabs,
    'tabs',
    (r) => (r as { data?: TabsRecord } | undefined)?.data
  )

export const putTabs = (tabs: TabsRecord): Promise<void> =>
  dbPut(getDB, STORES.tabs, { id: 'tabs', data: tabs })

export const clearTabs = (): Promise<void> => dbClear(getDB, STORES.tabs)

// ==================== MessageQueue ====================

// 简化的队列项（仅保留必要字段）
export interface QueueItem {
  id: string
  content: string
  order: number
  createdAt: number
}

// 按 pageId 存储的队列记录
export interface MessageQueueRecord {
  pageId: string
  items: QueueItem[]
  paused: boolean
}

export const getMessageQueue = (pageId: string): Promise<MessageQueueRecord | undefined> =>
  dbGet<MessageQueueRecord>(
    getDB,
    STORES.messageQueue,
    pageId,
    (r) => (r as { data?: MessageQueueRecord } | undefined)?.data
  )

export const putMessageQueue = (pageId: string, record: MessageQueueRecord): Promise<void> =>
  dbPut(getDB, STORES.messageQueue, { id: pageId, data: record })

export const deleteMessageQueue = (pageId: string): Promise<void> =>
  dbDelete(getDB, STORES.messageQueue, pageId)

export const getAllMessageQueues = (): Promise<MessageQueueRecord[]> =>
  dbGetAll<MessageQueueRecord>(getDB, STORES.messageQueue, (results) =>
    results.map((r) => (r as { data: MessageQueueRecord }).data)
  )

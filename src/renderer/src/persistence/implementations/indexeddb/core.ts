/**
 * IndexedDB core connection management and generic operations
 */

const DB_VERSION = 1

// ==================== Generic Operations ====================

/**
 * Execute single IDBRequest and return Promise
 */
export function execRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Execute transaction-level operations (for batch operations or multi-store operations)
 */
export function execTransaction(tx: IDBTransaction, operations: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.onerror = () => reject(tx.error)
    tx.oncomplete = () => resolve()
    operations()
  })
}

/**
 * Generic single record read
 */
export async function dbGet<T>(
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
 * Generic single record write
 */
export async function dbPut<T>(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string,
  value: T
): Promise<void> {
  const db = await getDbFn()
  const tx = db.transaction(storeName, 'readwrite')
  await execRequest(tx.objectStore(storeName).put(value))
}

/**
 * Generic single record delete
 */
export async function dbDelete(
  getDbFn: () => Promise<IDBDatabase>,
  storeName: string,
  key: IDBValidKey
): Promise<void> {
  const db = await getDbFn()
  const tx = db.transaction(storeName, 'readwrite')
  await execRequest(tx.objectStore(storeName).delete(key))
}

/**
 * Generic get all records
 */
export async function dbGetAll<T>(
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
 * Generic batch write
 */
export async function dbPutBatch<T>(
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
 * Generic batch delete
 */
export async function dbDeleteBatch(
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
 * Generic clear store
 */
export async function dbClear(
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

// ==================== Accounts Database ====================

const ACCOUNTS_DB_NAME = 'pointer-accounts'
const ACCOUNTS_STORES = {
  accounts: 'accounts',
  meta: 'meta'
} as const

let accountsDbInstance: IDBDatabase | null = null

export function getAccountsDB(): Promise<IDBDatabase> {
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
      if (!db.objectStoreNames.contains(ACCOUNTS_STORES.accounts)) {
        db.createObjectStore(ACCOUNTS_STORES.accounts, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(ACCOUNTS_STORES.meta)) {
        db.createObjectStore(ACCOUNTS_STORES.meta, { keyPath: 'key' })
      }
    }
  })
}

export { ACCOUNTS_STORES }

// ==================== User Database ====================

export const USER_STORES = {
  pages: 'pages',
  folders: 'folders',
  messages: 'messages',
  settings: 'settings',
  layout: 'layout',
  tabs: 'tabs',
  messageQueue: 'messageQueue'
} as const

let currentDbName = 'pointer-default'
let userDbInstance: IDBDatabase | null = null

export function getUserDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (userDbInstance && userDbInstance.name === currentDbName) {
      resolve(userDbInstance)
      return
    }

    if (userDbInstance) {
      userDbInstance.close()
      userDbInstance = null
    }

    const request = indexedDB.open(currentDbName, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      userDbInstance = request.result
      userDbInstance.onversionchange = () => {
        userDbInstance?.close()
        userDbInstance = null
      }
      userDbInstance.onclose = () => {
        userDbInstance = null
      }
      resolve(userDbInstance)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      const storeConfigs: Array<{ name: string; keyPath: string }> = [
        { name: USER_STORES.pages, keyPath: 'id' },
        { name: USER_STORES.folders, keyPath: 'id' },
        { name: USER_STORES.messages, keyPath: 'pageId' },
        { name: USER_STORES.settings, keyPath: 'id' },
        { name: USER_STORES.layout, keyPath: 'id' },
        { name: USER_STORES.tabs, keyPath: 'id' },
        { name: USER_STORES.messageQueue, keyPath: 'id' }
      ]
      for (const { name, keyPath } of storeConfigs) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath })
        }
      }
    }
  })
}

export function setUserDatabaseName(accountId: string): void {
  currentDbName = `pointer-${accountId}`
  if (userDbInstance) {
    userDbInstance.close()
    userDbInstance = null
  }
}

export function deleteUserDatabase(accountId: string): Promise<void> {
  const dbName = `pointer-${accountId}`
  return new Promise((resolve, reject) => {
    if (userDbInstance && currentDbName === dbName) {
      userDbInstance.close()
      userDbInstance = null
    }
    const request = indexedDB.deleteDatabase(dbName)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

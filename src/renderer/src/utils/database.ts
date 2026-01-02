import type { ChatMessage, PageFolder, Settings, Tab, TabHistoryEntry, Account } from '../types/type'

const DB_VERSION = 1
const STORES = {
  pages: 'pages',
  folders: 'folders',
  messages: 'messages',
  settings: 'settings',
  layout: 'layout',
  tabs: 'tabs'
} as const

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

export async function getAllAccounts(): Promise<Account[]> {
  const db = await getAccountsDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readonly')
    const request = tx.objectStore('accounts').getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result ?? [])
  })
}

export async function putAccount(account: Account): Promise<void> {
  const db = await getAccountsDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite')
    const request = tx.objectStore('accounts').put(account)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getAccountsDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite')
    const request = tx.objectStore('accounts').delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getCurrentAccountId(): Promise<string | null> {
  const db = await getAccountsDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly')
    const request = tx.objectStore('meta').get('currentAccountId')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result?.value ?? null)
  })
}

export async function setCurrentAccountId(id: string | null): Promise<void> {
  const db = await getAccountsDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite')
    const request = tx.objectStore('meta').put({ key: 'currentAccountId', value: id })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ==================== 用户数据库（按账户隔离） ====================

let currentDbName = 'pointer-default'
let dbInstance: IDBDatabase | null = null

// 页面记录（不含消息）
export interface PageRecord {
  id: string
  type: 'page'
  title: string
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
      if (!db.objectStoreNames.contains(STORES.pages)) {
        db.createObjectStore(STORES.pages, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.folders)) {
        db.createObjectStore(STORES.folders, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.messages)) {
        db.createObjectStore(STORES.messages, { keyPath: 'pageId' })
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.layout)) {
        db.createObjectStore(STORES.layout, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.tabs)) {
        db.createObjectStore(STORES.tabs, { keyPath: 'id' })
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

export async function getAllPages(): Promise<PageRecord[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.pages, 'readonly')
    const store = tx.objectStore(STORES.pages)
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result ?? [])
  })
}

export async function getPage(id: string): Promise<PageRecord | undefined> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.pages, 'readonly')
    const store = tx.objectStore(STORES.pages)
    const request = store.get(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export async function putPage(page: PageRecord): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.pages, 'readwrite')
    const store = tx.objectStore(STORES.pages)
    const request = store.put(page)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.pages, STORES.messages], 'readwrite')
    tx.objectStore(STORES.pages).delete(id)
    tx.objectStore(STORES.messages).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ==================== Folders ====================

export async function getAllFolders(): Promise<PageFolder[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.folders, 'readonly')
    const store = tx.objectStore(STORES.folders)
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result ?? [])
  })
}

export async function putFolder(folder: PageFolder): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.folders, 'readwrite')
    const store = tx.objectStore(STORES.folders)
    const request = store.put(folder)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.folders, 'readwrite')
    const store = tx.objectStore(STORES.folders)
    const request = store.delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ==================== Messages ====================

export async function getMessages(pageId: string): Promise<MessagesRecord | undefined> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.messages, 'readonly')
    const store = tx.objectStore(STORES.messages)
    const request = store.get(pageId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export async function putMessages(record: MessagesRecord): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.messages, 'readwrite')
    const store = tx.objectStore(STORES.messages)
    const request = store.put(record)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function deleteMessages(pageId: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.messages, 'readwrite')
    const store = tx.objectStore(STORES.messages)
    const request = store.delete(pageId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ==================== Settings ====================

export async function getSettings(): Promise<Settings | undefined> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.settings, 'readonly')
    const store = tx.objectStore(STORES.settings)
    const request = store.get('settings')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result?.data)
  })
}

export async function putSettings(settings: Settings): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.settings, 'readwrite')
    const store = tx.objectStore(STORES.settings)
    const request = store.put({ id: 'settings', data: settings })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ==================== Layout ====================

export type ActivityPanel = 'explorer' | 'search' | 'favorites' | 'tasks'

export interface LayoutRecord {
  sidebarWidth: number
  sidebarVisible: boolean
  activePanel: ActivityPanel
}

export async function getLayout(): Promise<LayoutRecord | undefined> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.layout, 'readonly')
    const store = tx.objectStore(STORES.layout)
    const request = store.get('layout')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result?.data)
  })
}

export async function putLayout(layout: LayoutRecord): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.layout, 'readwrite')
    const store = tx.objectStore(STORES.layout)
    const request = store.put({ id: 'layout', data: layout })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ==================== Tabs ====================

export interface TabsRecord {
  tabs: Tab[]
  activeTabId: string | null
  history: TabHistoryEntry[]
  historyIndex: number
}

export async function getTabs(): Promise<TabsRecord | undefined> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.tabs, 'readonly')
    const store = tx.objectStore(STORES.tabs)
    const request = store.get('tabs')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result?.data)
  })
}

export async function putTabs(tabs: TabsRecord): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.tabs, 'readwrite')
    const store = tx.objectStore(STORES.tabs)
    const request = store.put({ id: 'tabs', data: tabs })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

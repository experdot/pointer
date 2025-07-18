// 基于 IndexedDB 的持久化配置

const DB_NAME = 'PointerAppDB'
const DB_VERSION = 1

// 对象存储名称
const OBJECT_STORES = {
  PAGES: 'pages',
  FOLDERS: 'folders',
  SETTINGS: 'settings',
  MESSAGES: 'messages',
  SEARCH: 'search',
  TABS: 'tabs',
  UI: 'ui',
  OBJECTS: 'objects',
  CROSSTAB: 'crosstab',
  AI_TASKS: 'ai_tasks'
}

// 防抖定时器管理
const debounceTimers = new Map<string, NodeJS.Timeout>()

// 防抖函数
const debounce = (key: string, fn: () => void, delay: number = 100) => {
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key)!)
  }

  const timer = setTimeout(() => {
    fn()
    debounceTimers.delete(key)
  }, delay)

  debounceTimers.set(key, timer)
}

// IndexedDB 数据库初始化
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // 创建各种对象存储
      Object.values(OBJECT_STORES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const objectStore = db.createObjectStore(storeName, { keyPath: 'id' })
          // 为 pages 和 folders 创建索引
          if (storeName === OBJECT_STORES.PAGES) {
            objectStore.createIndex('folderId', 'folderId', { unique: false })
            objectStore.createIndex('type', 'type', { unique: false })
          }
          if (storeName === OBJECT_STORES.FOLDERS) {
            objectStore.createIndex('parentId', 'parentId', { unique: false })
          }
        }
      })
    }
  })
}

// 通用的 IndexedDB 操作类
class IndexedDBStorage {
  private db: IDBDatabase | null = null
  private dbPromise: Promise<IDBDatabase>

  constructor() {
    this.dbPromise = initDB().then((db) => {
      this.db = db
      return db
    })
  }

  // 获取数据
  async getItem(storeName: string, key: string): Promise<any> {
    try {
      const db = await this.dbPromise
      const transaction = db.transaction([storeName], 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.get(key)

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.data || null)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`Error getting item ${key} from ${storeName}:`, error)
      return null
    }
  }

  // 存储数据
  async setItem(storeName: string, key: string, value: any): Promise<void> {
    try {
      const db = await this.dbPromise
      const transaction = db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.put({ id: key, data: value, timestamp: Date.now() })

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`Error setting item ${key} in ${storeName}:`, error)
      throw error
    }
  }

  // 删除数据
  async removeItem(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.dbPromise
      const transaction = db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.delete(key)

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`Error removing item ${key} from ${storeName}:`, error)
      throw error
    }
  }

  // 获取所有数据
  async getAllItems(storeName: string): Promise<any[]> {
    try {
      const db = await this.dbPromise
      const transaction = db.transaction([storeName], 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.getAll()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result.map((item) => item.data))
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`Error getting all items from ${storeName}:`, error)
      return []
    }
  }

  // 清空存储
  async clearStore(storeName: string): Promise<void> {
    try {
      const db = await this.dbPromise
      const transaction = db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.clear()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`Error clearing store ${storeName}:`, error)
      throw error
    }
  }
}

// 全局 IndexedDB 存储实例
const indexedDBStorage = new IndexedDBStorage()

// 为 pages 特别定制的存储类
class PagesStorage {
  private storeName = OBJECT_STORES.PAGES

  // 获取单个页面
  async getPage(pageId: string): Promise<any> {
    return await indexedDBStorage.getItem(this.storeName, pageId)
  }

  // 获取所有页面
  async getAllPages(): Promise<any[]> {
    return await indexedDBStorage.getAllItems(this.storeName)
  }

  // 保存单个页面
  async savePage(page: any): Promise<void> {
    debounce(
      `page-${page.id}`,
      async () => {
        await indexedDBStorage.setItem(this.storeName, page.id, page)
      },
      100
    )
  }

  // 删除单个页面
  async deletePage(pageId: string): Promise<void> {
    await indexedDBStorage.removeItem(this.storeName, pageId)
  }

  // 批量保存页面
  async savePages(pages: any[]): Promise<void> {
    const promises = pages.map((page) => indexedDBStorage.setItem(this.storeName, page.id, page))
    await Promise.all(promises)
  }

  // 清空所有页面
  async clearAllPages(): Promise<void> {
    await indexedDBStorage.clearStore(this.storeName)
  }
}

// 全局 pages 存储实例
const pagesStorage = new PagesStorage()

// 为 folders 特别定制的存储类
class FoldersStorage {
  private storeName = OBJECT_STORES.FOLDERS

  async getFolder(folderId: string): Promise<any> {
    return await indexedDBStorage.getItem(this.storeName, folderId)
  }

  async getAllFolders(): Promise<any[]> {
    return await indexedDBStorage.getAllItems(this.storeName)
  }

  async saveFolder(folder: any): Promise<void> {
    debounce(
      `folder-${folder.id}`,
      async () => {
        await indexedDBStorage.setItem(this.storeName, folder.id, folder)
      },
      100
    )
  }

  async deleteFolder(folderId: string): Promise<void> {
    await indexedDBStorage.removeItem(this.storeName, folderId)
  }

  async saveFolders(folders: any[]): Promise<void> {
    const promises = folders.map((folder) =>
      indexedDBStorage.setItem(this.storeName, folder.id, folder)
    )
    await Promise.all(promises)
  }

  async clearAllFolders(): Promise<void> {
    await indexedDBStorage.clearStore(this.storeName)
  }
}

// 全局 folders 存储实例
const foldersStorage = new FoldersStorage()

// 为 pages store 创建特殊的持久化配置
export const createPagesPersistConfig = (storeName: string, version: number = 1) => ({
  name: storeName,
  storage: {
    getItem: async (name: string) => {
      try {
        console.log('Loading pages and folders from IndexedDB...')
        const [pages, folders] = await Promise.all([
          pagesStorage.getAllPages(),
          foldersStorage.getAllFolders()
        ])
        return { state: { pages, folders }, version }
      } catch (error) {
        console.error(`Error loading ${name} from IndexedDB:`, error)
        return null
      }
    },
    setItem: async (name: string, value: any) => {
      // 对于 pages store，我们需要特殊处理
      debounce(
        `${storeName}-${name}`,
        async () => {
          try {
            console.log('Saving pages and folders to IndexedDB...')
            // value.state 包含实际的状态数据
            if (value.state?.pages) {
              await pagesStorage.savePages(value.state.pages)
            }
            if (value.state?.folders) {
              await foldersStorage.saveFolders(value.state.folders)
            }
          } catch (error) {
            console.error(`Error saving ${name} to IndexedDB:`, error)
          }
        },
        100
      )
    },
    removeItem: async (name: string) => {
      try {
        console.log('Removing pages and folders from IndexedDB...')
        await Promise.all([pagesStorage.clearAllPages(), foldersStorage.clearAllFolders()])
      } catch (error) {
        console.error(`Error removing ${name} from IndexedDB:`, error)
      }
    }
  },
  version
})

// 通用的 IndexedDB 持久化配置
export const createPersistConfig = <T>(
  storeName: string,
  version: number = 1,
  partialize?: (state: any) => any
) => ({
  name: storeName,
  storage: {
    getItem: async (name: string) => {
      try {
        console.log('getItem from IndexedDB:', name)
        return await indexedDBStorage.getItem(getObjectStoreName(storeName), name)
      } catch (error) {
        console.error(`Error loading ${name} from IndexedDB:`, error)
        return null
      }
    },
    setItem: async (name: string, value: T) => {
      debounce(
        `${storeName}-${name}`,
        async () => {
          try {
            console.log('setItem to IndexedDB:', name, value)
            await indexedDBStorage.setItem(getObjectStoreName(storeName), name, value)
          } catch (error) {
            console.error(`Error saving ${name} to IndexedDB:`, error)
          }
        },
        100
      )
    },
    removeItem: async (name: string) => {
      try {
        console.log('removeItem from IndexedDB:', name)
        await indexedDBStorage.removeItem(getObjectStoreName(storeName), name)
      } catch (error) {
        console.error(`Error removing ${name} from IndexedDB:`, error)
      }
    }
  },
  version,
  ...(partialize && { partialize })
})

// 根据 store 名称获取对应的对象存储名称
function getObjectStoreName(storeName: string): string {
  const storeMap: { [key: string]: string } = {
    'settings-store': OBJECT_STORES.SETTINGS,
    'messages-store': OBJECT_STORES.MESSAGES,
    'search-store': OBJECT_STORES.SEARCH,
    'tabs-store': OBJECT_STORES.TABS,
    'ui-store': OBJECT_STORES.UI,
    'object-store': OBJECT_STORES.OBJECTS,
    'crosstab-store': OBJECT_STORES.CROSSTAB,
    'ai-tasks-store': OBJECT_STORES.AI_TASKS
  }
  return storeMap[storeName] || storeName
}

// 通用的store状态清除函数
export const clearStoreState = async (storeName: string) => {
  try {
    await indexedDBStorage.clearStore(getObjectStoreName(storeName))
  } catch (error) {
    console.error(`Error clearing store ${storeName}:`, error)
  }
}

// 通用的错误处理
export const handleStoreError = (storeName: string, action: string, error: any) => {
  console.error(`Error in ${storeName} store - ${action}:`, error)
}

// 通用的状态初始化
export const initializeStoreState = async <T>(
  storeName: string,
  defaultState: T,
  loadFromStorage: boolean = true
): Promise<T> => {
  if (!loadFromStorage) {
    return defaultState
  }

  try {
    const saved = await indexedDBStorage.getItem(getObjectStoreName(storeName), storeName)
    if (saved) {
      return { ...defaultState, ...saved }
    }
  } catch (error) {
    console.error(`Error initializing ${storeName} store:`, error)
  }

  return defaultState
}

// 导出单独的存储实例供外部使用
export { pagesStorage, foldersStorage, indexedDBStorage }

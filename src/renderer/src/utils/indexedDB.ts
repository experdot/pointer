import type { PersistStorage, StorageValue } from 'zustand/middleware'

const DB_VERSION = 1
const STORE_NAME = 'zustand-store'

let currentDbName = 'pointer-default'
let dbInstance: IDBDatabase | null = null

// 获取或创建数据库连接
function getDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance && currentDbName === dbName) {
      resolve(dbInstance)
      return
    }

    // 关闭旧连接
    if (dbInstance) {
      dbInstance.close()
      dbInstance = null
    }

    const request = indexedDB.open(dbName, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      dbInstance = request.result
      currentDbName = dbName

      // 处理其他标签页升级数据库的情况
      dbInstance.onversionchange = () => {
        dbInstance?.close()
        dbInstance = null
      }

      // 处理连接意外关闭
      dbInstance.onclose = () => {
        dbInstance = null
      }

      resolve(dbInstance)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

// 设置当前数据库名称（用于账户切换）
export function setDatabaseName(accountId: string): void {
  currentDbName = `pointer-${accountId}`
  // 关闭旧连接，下次操作时会重新连接
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

// 创建 Zustand persist 存储适配器
export function createIndexedDBStorage<T>(): PersistStorage<T> {
  return {
    getItem: async (name: string): Promise<StorageValue<T> | null> => {
      const db = await getDB(currentDbName)
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(name)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result ?? null)
      })
    },

    setItem: async (name: string, value: StorageValue<T>): Promise<void> => {
      const db = await getDB(currentDbName)
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.put(value, name)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    },

    removeItem: async (name: string): Promise<void> => {
      const db = await getDB(currentDbName)
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.delete(name)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    }
  }
}

// 清空当前数据库所有数据
export async function clearDatabase(): Promise<void> {
  const db = await getDB(currentDbName)
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// 删除指定数据库
export function deleteDatabase(accountId: string): Promise<void> {
  const dbName = `pointer-${accountId}`
  return new Promise((resolve, reject) => {
    // 如果是当前数据库，先关闭连接
    if (dbInstance && currentDbName === dbName) {
      dbInstance.close()
      dbInstance = null
    }

    const request = indexedDB.deleteDatabase(dbName)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

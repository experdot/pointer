import { StorageService } from '../services/storageService'

// 通用的持久化配置
export const createPersistConfig = <T>(storeName: string, version: number = 1) => ({
  name: storeName,
  storage: {
    getItem: (name: string) => {
      try {
        const item = localStorage.getItem(name)
        return item ? JSON.parse(item) : null
      } catch (error) {
        console.error(`Error loading ${name} from localStorage:`, error)
        return null
      }
    },
    setItem: (name: string, value: T) => {
      try {
        localStorage.setItem(name, JSON.stringify(value))
      } catch (error) {
        console.error(`Error saving ${name} to localStorage:`, error)
      }
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name)
      } catch (error) {
        console.error(`Error removing ${name} from localStorage:`, error)
      }
    }
  },
  version
})

// 通用的store状态清除函数
export const clearStoreState = (storeName: string) => {
  try {
    localStorage.removeItem(storeName)
  } catch (error) {
    console.error(`Error clearing store ${storeName}:`, error)
  }
}

// 通用的错误处理
export const handleStoreError = (storeName: string, action: string, error: any) => {
  console.error(`Error in ${storeName} store - ${action}:`, error)
}

// 通用的状态初始化
export const initializeStoreState = <T>(
  storeName: string,
  defaultState: T,
  loadFromStorage: boolean = true
): T => {
  if (!loadFromStorage) {
    return defaultState
  }

  try {
    const saved = localStorage.getItem(storeName)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...defaultState, ...parsed }
    }
  } catch (error) {
    console.error(`Error initializing ${storeName} store:`, error)
  }

  return defaultState
}

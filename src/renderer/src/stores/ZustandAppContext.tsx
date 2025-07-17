import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import { useAppStores } from './useAppStores'

// 创建一个轻量级的Context用于数据初始化
interface ZustandAppContextValue {
  isLoaded: boolean
}

const ZustandAppContext = createContext<ZustandAppContextValue | undefined>(undefined)

// Provider组件
export function ZustandAppProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = React.useState(false)
  const stores = useAppStores()

  // 初始化数据加载
  useEffect(() => {
    const initializeStores = async () => {
      try {
        // 这里可以添加任何需要的初始化逻辑
        console.log('Zustand stores initialized')
        setIsLoaded(true)
      } catch (error) {
        console.error('Error initializing Zustand stores:', error)
        setIsLoaded(true) // 即使出错也要设置为已加载
      }
    }

    initializeStores()
  }, [])

  return <ZustandAppContext.Provider value={{ isLoaded }}>{children}</ZustandAppContext.Provider>
}

// Hook用于获取Context值
export function useZustandAppContext() {
  const context = useContext(ZustandAppContext)
  if (context === undefined) {
    throw new Error('useZustandAppContext must be used within a ZustandAppProvider')
  }
  return context
}
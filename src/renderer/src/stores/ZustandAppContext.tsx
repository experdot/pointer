import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { Spin } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { useSettingsStore } from './settingsStore'
import { usePagesStore } from './pagesStore'
import { useTabsStore } from './tabsStore'
import { useUIStore } from './uiStore'
import { useSearchStore } from './searchStore'
import { useMessagesStore } from './messagesStore'
import { useCrosstabStore } from './crosstabStore'
import { useObjectStore } from './objectStore'
import { useAITasksStore } from './aiTasksStore'

// 创建一个轻量级的Context用于数据初始化
interface ZustandAppContextValue {
  isLoaded: boolean
  isInitializing: boolean
}

const ZustandAppContext = createContext<ZustandAppContextValue | undefined>(undefined)

// Provider组件
export function ZustandAppProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  // 初始化数据加载
  useEffect(() => {
    const initializeStores = async () => {
      try {
        console.log('开始等待所有 stores 的持久化数据加载...')

        // 等待所有 stores 的持久化数据加载完成
        const storePromises = [
          // 等待 settings store 加载完成
          new Promise<void>((resolve) => {
            const checkSettings = () => {
              if (useSettingsStore.persist.hasHydrated()) {
                console.log('Settings store 已加载完成')
                resolve()
              } else {
                setTimeout(checkSettings, 10)
              }
            }
            checkSettings()
          }),

          // 等待 pages store 加载完成
          new Promise<void>((resolve) => {
            const checkPages = () => {
              if (usePagesStore.persist.hasHydrated()) {
                console.log('Pages store 已加载完成')
                resolve()
              } else {
                setTimeout(checkPages, 10)
              }
            }
            checkPages()
          }),

          // 等待 tabs store 加载完成
          new Promise<void>((resolve) => {
            const checkTabs = () => {
              if (useTabsStore.persist.hasHydrated()) {
                console.log('Tabs store 已加载完成')
                resolve()
              } else {
                setTimeout(checkTabs, 10)
              }
            }
            checkTabs()
          }),

          // 等待 ui store 加载完成
          new Promise<void>((resolve) => {
            const checkUI = () => {
              if (useUIStore.persist.hasHydrated()) {
                console.log('UI store 已加载完成')
                resolve()
              } else {
                setTimeout(checkUI, 10)
              }
            }
            checkUI()
          }),

          // 等待 search store 加载完成
          new Promise<void>((resolve) => {
            const checkSearch = () => {
              if (useSearchStore.persist.hasHydrated()) {
                console.log('Search store 已加载完成')
                resolve()
              } else {
                setTimeout(checkSearch, 10)
              }
            }
            checkSearch()
          }),

          // 等待 messages store 加载完成
          new Promise<void>((resolve) => {
            const checkMessages = () => {
              if (useMessagesStore.persist.hasHydrated()) {
                console.log('Messages store 已加载完成')
                resolve()
              } else {
                setTimeout(checkMessages, 10)
              }
            }
            checkMessages()
          }),

          // 等待 crosstab store 加载完成
          new Promise<void>((resolve) => {
            const checkCrosstab = () => {
              if (useCrosstabStore.persist.hasHydrated()) {
                console.log('Crosstab store 已加载完成')
                resolve()
              } else {
                setTimeout(checkCrosstab, 10)
              }
            }
            checkCrosstab()
          }),

          // 等待 object store 加载完成
          new Promise<void>((resolve) => {
            const checkObject = () => {
              if (useObjectStore.persist.hasHydrated()) {
                console.log('Object store 已加载完成')
                resolve()
              } else {
                setTimeout(checkObject, 10)
              }
            }
            checkObject()
          }),

          // 等待 aiTasks store 加载完成
          new Promise<void>((resolve) => {
            const checkAITasks = () => {
              if (useAITasksStore.persist.hasHydrated()) {
                console.log('AITasks store 已加载完成')
                resolve()
              } else {
                setTimeout(checkAITasks, 10)
              }
            }
            checkAITasks()
          })
        ]

        // 等待所有 stores 初始化完成
        await Promise.all(storePromises)

        // 额外等待一小段时间确保所有数据都已正确加载
        await new Promise((resolve) => setTimeout(resolve, 50))

        console.log('所有 Zustand stores 初始化完成')
        setIsLoaded(true)
        setIsInitializing(false)
      } catch (error) {
        console.error('初始化 Zustand stores 时出错:', error)
        setIsLoaded(true) // 即使出错也要设置为已加载，避免无限加载
        setIsInitializing(false)
      }
    }

    initializeStores()
  }, [])

  // 在数据加载完成之前显示加载界面
  if (isInitializing) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100vw',
          height: '100vh',
          flexDirection: 'column',
          background: '#f5f5f5'
        }}
      >
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 48, color: '#1890ff' }} spin />}
          size="large"
        />
        <div
          style={{
            marginTop: 24,
            fontSize: 16,
            color: '#666',
            textAlign: 'center'
          }}
        >
          <div>正在加载应用数据...</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            请稍候，正在从本地存储恢复您的数据
          </div>
        </div>
      </div>
    )
  }

  return (
    <ZustandAppContext.Provider value={{ isLoaded, isInitializing }}>
      {children}
    </ZustandAppContext.Provider>
  )
}

// Hook for accessing the context
export const useZustandApp = () => {
  const context = useContext(ZustandAppContext)
  if (context === undefined) {
    throw new Error('useZustandApp must be used within a ZustandAppProvider')
  }
  return context
}

// 默认导出
export default ZustandAppProvider

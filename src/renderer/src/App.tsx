import React, { useEffect, useState } from 'react'
import { ConfigProvider, theme, App as AntdApp, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './App.css'
import './tabTypes' // 注册 tab 类型
import { initializeExportPlugins } from './features/export' // 注册导出插件
import UpdateNotification from './components/common/UpdateNotification'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { MainLayout } from './components/layout/MainLayout'
import { useAccountStore } from './stores/accountStore'
import { initializeAccountSystem } from './services/accountService'

// Initialize export plugins
initializeExportPlugins()

function AppContent(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const initialized = useAccountStore((state) => state.initialized)

  useEffect(() => {
    initializeAccountSystem().finally(() => setLoading(false))
  }, [])

  if (loading || !initialized) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <Spin size="large" />
      </div>
    )
  }

  return (
    <>
      <UpdateNotification />
      <MainLayout />
    </>
  )
}

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ConfigProvider
        locale={zhCN}
        theme={{
          cssVar: true,
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 4,
            fontSize: 14
          },
          components: {
            Menu: {
              itemHeight: 32,
              itemMarginInline: 4
            },
            Tree: {
              titleHeight: 32
            }
          }
        }}
      >
        <AntdApp className="app-layout">
          <AppContent />
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  )
}

export default App

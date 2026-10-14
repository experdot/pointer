import React, { useEffect, useState } from 'react'
import { ConfigProvider, theme, App as AntdApp, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './App.css'
import { initializeTabTypes } from './utils/tabTypeRegistrations'
import { initializeExportPlugins } from './features/export'
import { UpdateNotification } from './components/common/UpdateNotification'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AppShortcuts } from './components/common/AppShortcuts'
import { MainLayout } from './components/layout/MainLayout'
import { useSessionStore } from './stores/sessionStore'
import { bootstrapRuntime } from './runtime/bootstrap'

// 注册插件（页签类型与导出插件）
initializeTabTypes()
initializeExportPlugins()

function AppContent(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useSessionStore((state) => state.initialized)

  useEffect(() => {
    bootstrapRuntime()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setLoading(false))
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

  if (error) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}
      >
        内核启动失败：{error}
      </div>
    )
  }

  return (
    <>
      <AppShortcuts />
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

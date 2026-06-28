import React, { useEffect, useState } from 'react'
import { ConfigProvider, theme, App as AntdApp, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './App.css'
import { initializeTabTypes } from './utils/tabTypeRegistrations'
import { initializeExportPlugins } from './features/export'
import { initStores } from './stores/initStores'
import { initPersistence } from './persistence/initPersistence'
import { UpdateNotification } from './components/common/UpdateNotification'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { SwitchTransactionOverlay } from './components/common/SwitchTransactionOverlay'
import { AppShortcuts } from './components/common/AppShortcuts'
import { MainLayout } from './components/layout/MainLayout'
import { useAccountStore } from './stores/accountStore'
import { useSwitchTransactionStore } from './stores/switchTransactionStore'
import { initializeAccountSystem } from './services/accountService'

// Initialize plugins and stores
initializeTabTypes()
initializeExportPlugins()
initPersistence()
initStores()

function AppContent(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const initialized = useAccountStore((state) => state.initialized)
  const switchInProgress = useSwitchTransactionStore((state) => state.inProgress)

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

  if (switchInProgress) {
    return <SwitchTransactionOverlay />
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

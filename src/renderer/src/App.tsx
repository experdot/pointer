import React from 'react'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Layout from './components/layout/Layout'
import { ZustandAppProvider } from './stores/ZustandAppContext'
import './App.css'

function AppContent(): React.JSX.Element {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff'
        }
      }}
    >
      <AntdApp>
        <ZustandAppProvider>
          <Layout />
        </ZustandAppProvider>
      </AntdApp>
    </ConfigProvider>
  )
}

function App(): React.JSX.Element {
  return <AppContent />
}

export default App

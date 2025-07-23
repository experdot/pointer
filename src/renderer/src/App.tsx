import React from 'react'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Layout from './components/layout/Layout'
import { ZustandAppProvider } from './stores/ZustandAppContext'
import './App.css'
import UpdateNotification from './components/common/UpdateNotification'

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
  return (
    <div className="container">
      <UpdateNotification />
      <AppContent />
    </div>
  )
}

export default App

import React from 'react'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './App.css'
import UpdateNotification from './components/common/UpdateNotification'

function AppContent(): React.JSX.Element {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          fontSize: 14
        }
      }}
    >
      <AntdApp>
        <UpdateNotification />
      </AntdApp>
    </ConfigProvider>
  )
}

function App(): React.JSX.Element {
  return (
    <div className="container">
      <AppContent />
    </div>
  )
}

export default App

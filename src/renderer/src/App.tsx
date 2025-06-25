import React from 'react'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AppProvider, useAppContext } from './store/AppContext'
import Layout from './components/Layout'
import './App.css'

function AppContent(): React.JSX.Element {
  const { state } = useAppContext()

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: state.settings.theme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff'
        }
      }}
    >
      <AntdApp>
        <Layout />
      </AntdApp>
    </ConfigProvider>
  )
}

function App(): React.JSX.Element {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App

import React from 'react'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Layout from './components/layout/Layout'
import { ZustandAppProvider } from './stores/ZustandAppContext'
import { useSettingsStore } from './stores/settingsStore'
import './App.css'
import UpdateNotification from './components/common/UpdateNotification'

function AppContent(): React.JSX.Element {
  const { settings } = useSettingsStore()

  // 根据字体大小设置获取基础字号
  const getFontSize = () => {
    switch (settings.fontSize) {
      case 'small':
        return 12
      case 'large':
        return 16
      case 'medium':
      default:
        return 14
    }
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          fontSize: getFontSize()
        }
      }}
    >
      <AntdApp>
        <UpdateNotification />
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
      <AppContent />
    </div>
  )
}

export default App

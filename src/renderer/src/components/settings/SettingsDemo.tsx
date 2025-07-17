import React, { useState, useEffect } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  Descriptions,
  Badge,
  Alert,
  Statistic,
  Row,
  Col
} from 'antd'
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePagesStore } from '../../stores/pagesStore'

export default function SettingsDemo() {
  const { settings } = useSettingsStore()
  const [storageInfo, setStorageInfo] = useState({
    settings: '0 KB',
    pages: '0 KB',
    folders: '0 KB',
    total: '0 KB'
  })

  const updateStorageInfo = () => {
    try {
      const settingsData = useSettingsStore.getState().settings
      const chatsData = usePagesStore.getState().pages
      const foldersData = usePagesStore.getState().folders

      const settingsSize = JSON.stringify(settingsData || {}).length
      const chatsSize = JSON.stringify(chatsData || []).length
      const foldersSize = JSON.stringify(foldersData || []).length
      const totalSize = settingsSize + chatsSize + foldersSize

      setStorageInfo({
        settings: `${(settingsSize / 1024).toFixed(2)} KB`,
        pages: `${(chatsSize / 1024).toFixed(2)} KB`,
        folders: `${(foldersSize / 1024).toFixed(2)} KB`,
        total: `${(totalSize / 1024).toFixed(2)} KB`
      })
    } catch (error) {
      console.error('Failed to calculate storage info:', error)
    }
  }

  useEffect(() => {
    updateStorageInfo()

    // 定期更新存储信息
    const interval = setInterval(updateStorageInfo, 5000)
    return () => clearInterval(interval)
  }, [])

  const testPersistence = () => {
    const testKey = 'persistence-test'
    const testValue = { timestamp: Date.now(), test: true }

    try {
      localStorage.setItem(testKey, JSON.stringify(testValue))
      const retrieved = JSON.parse(localStorage.getItem(testKey) || '{}')
      localStorage.removeItem(testKey)

      return retrieved.test === true
    } catch {
      return false
    }
  }

  const isPersistenceWorking = testPersistence()

  return (
    <Card
      size="small"
      title={
        <Space>
          <DatabaseOutlined />
          持久化状态
        </Space>
      }
      bordered={false}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {isPersistenceWorking ? (
          <Alert
            message="持久化功能正常"
            description="您的设置和数据将在下次启动时自动恢复"
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
          />
        ) : (
          <Alert
            message="持久化功能异常"
            description="可能无法保存您的设置，请检查浏览器存储权限"
            type="error"
            icon={<InfoCircleOutlined />}
            showIcon
          />
        )}

        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="LLM配置" value={settings.llmConfigs?.length || 0} suffix="个" />
          </Col>
          <Col span={6}>
            <Statistic title="字体大小" value={settings.fontSize} />
          </Col>
          <Col span={6}>
            <Statistic title="存储使用" value={storageInfo.total} />
          </Col>
        </Row>

        <Descriptions title="存储详情" size="small" column={2}>
          <Descriptions.Item label="设置数据">
            <Badge status="processing" text={storageInfo.settings} />
          </Descriptions.Item>
          <Descriptions.Item label="聊天记录">
            <Badge status="processing" text={storageInfo.pages} />
          </Descriptions.Item>
          <Descriptions.Item label="文件夹数据">
            <Badge status="processing" text={storageInfo.folders} />
          </Descriptions.Item>
          <Descriptions.Item label="总计">
            <Badge status="success" text={storageInfo.total} />
          </Descriptions.Item>
        </Descriptions>

        <Space>
          <Button icon={<DatabaseOutlined />} onClick={updateStorageInfo} size="small">
            刷新存储信息
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => {
              console.log('Current settings:', settings)
              console.log('Storage info:', storageInfo)
            }}
            size="small"
          >
            控制台输出状态
          </Button>
        </Space>

        <Alert
          message="持久化说明"
          description={
            <div>
              <p>• 设置会在每次修改后立即保存到本地存储</p>
              <p>• 聊天记录会在发送消息后自动保存</p>
              <p>• 应用启动时会自动加载之前保存的所有数据</p>
              <p>• 数据存储在浏览器的localStorage中</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  )
}

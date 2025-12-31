import React, { useState } from 'react'
import { Form, Button, Input, Flex, Empty, Space, App } from 'antd'
import { ApiOutlined } from '@ant-design/icons'
import { useSettings, useLLMConfigs } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import type { LLMConfig, ConfigFolder } from '../../../types/type'

export function LLMConfigPanel(): React.JSX.Element {
  const {
    items,
    folders,
    expandedKeys,
    getItemsInFolder,
    batchUpdateItemsOrder,
    createConfig,
    updateConfig,
    deleteConfig,
    copyConfig,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolderExpanded
  } = useLLMConfigs()
  const { defaultLLMId, setDefaultLLMId } = useSettings()
  const { message } = App.useApp()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)
  const [testing, setTesting] = useState(false)

  const selectedConfig = items.find((c) => c.id === selectedId)

  const isItem = (item: LLMConfig | ConfigFolder): item is LLMConfig => 'apiHost' in item

  const handleTest = async (config: LLMConfig): Promise<void> => {
    setTesting(true)
    try {
      const result = await window.api.ai.testConnection(config)
      if (result.success) {
        message.success('连接成功')
      } else {
        message.error(result.error || '连接失败')
      }
    } catch {
      message.error('测试失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Flex className="settings-config-panel" gap={16}>
      <ConfigTree<LLMConfig>
        items={items}
        folders={folders}
        expandedKeys={expandedKeys}
        selectedId={selectedId}
        onSelect={setSelectedId}
        itemIcon={<ApiOutlined />}
        itemNameKey="name"
        isItem={isItem}
        getItemsInFolder={getItemsInFolder}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
        createItem={() => createConfig({ name: '新配置', apiHost: '', apiKey: '', modelName: '' })}
        updateItem={updateConfig}
        deleteItem={deleteConfig}
        copyItem={copyConfig}
        createFolder={createFolder}
        updateFolder={updateFolder}
        deleteFolder={deleteFolder}
        toggleFolderExpanded={toggleFolderExpanded}
        defaultItemId={defaultLLMId}
        emptyText="暂无配置"
        addItemText="添加配置"
      />

      <div className="settings-config-detail">
        {selectedConfig ? (
          <Form layout="vertical" key={selectedConfig.id}>
            <Form.Item label="名称">
              <Input
                value={selectedConfig.name}
                onChange={(e) => updateConfig(selectedConfig.id, { name: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="API Host">
              <Input
                value={selectedConfig.apiHost}
                onChange={(e) => updateConfig(selectedConfig.id, { apiHost: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </Form.Item>
            <Form.Item label="API Key">
              <Input.Password
                value={selectedConfig.apiKey}
                onChange={(e) => updateConfig(selectedConfig.id, { apiKey: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="模型名称">
              <Input
                value={selectedConfig.modelName}
                onChange={(e) => updateConfig(selectedConfig.id, { modelName: e.target.value })}
                placeholder="gpt-4"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type={defaultLLMId === selectedConfig.id ? 'primary' : 'default'}
                  onClick={() =>
                    setDefaultLLMId(defaultLLMId === selectedConfig.id ? undefined : selectedConfig.id)
                  }
                >
                  {defaultLLMId === selectedConfig.id ? '已设为默认' : '设为默认'}
                </Button>
                <Button onClick={() => handleTest(selectedConfig)} loading={testing}>
                  测试连接
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <Empty description="选择或创建配置" />
        )}
      </div>
    </Flex>
  )
}

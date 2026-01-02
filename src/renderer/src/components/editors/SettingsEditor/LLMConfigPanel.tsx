import React, { useState } from 'react'
import { Form, Button, Input, Flex, Empty, Space, App, Select, AutoComplete } from 'antd'
import { ApiOutlined } from '@ant-design/icons'
import { useSettings, useLLMConfigs, useModelConfigs } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import { AIService } from '../../../services/aiService'
import type { LLMConfig, ConfigFolder } from '../../../types/type'

const BASE_URL_PRESETS = [
  { value: 'https://api.openai.com/v1', label: 'OpenAI' },
  { value: 'https://openrouter.ai/api/v1', label: 'OpenRouter' },
  { value: 'http://localhost:11434/v1', label: 'Ollama Local' }
]

export function LLMConfigPanel(): React.JSX.Element {
  const {
    items,
    folders,
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
  const { items: modelConfigs } = useModelConfigs()
  const { message } = App.useApp()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)
  const [testing, setTesting] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelOptionsMap, setModelOptionsMap] = useState<Record<string, string[]>>({})

  const selectedConfig = items.find((c) => c.id === selectedId)
  const modelOptions = selectedId ? modelOptionsMap[selectedId] || [] : []

  const isItem = (item: LLMConfig | ConfigFolder): item is LLMConfig => item.type !== 'folder'

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

  const handleFetchModels = async (config: LLMConfig): Promise<void> => {
    if (fetchingModels) return
    setFetchingModels(true)
    try {
      const result = await AIService.getModels(config)
      if (result.success && result.models) {
        setModelOptionsMap((prev) => ({ ...prev, [config.id]: result.models! }))
      }
    } catch {
      // 静默失败，保留旧列表
    } finally {
      setFetchingModels(false)
    }
  }

  const handleCopyAsText = (config: LLMConfig): void => {
    const text = `名称: ${config.name}
API Base URL: ${config.baseUrl}
API Key: ${config.apiKey}
模型名称: ${config.modelName}`
    navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  }

  return (
    <Flex className="settings-config-panel" gap={16}>
      <ConfigTree<LLMConfig>
        items={items}
        folders={folders}
        selectedId={selectedId}
        onSelect={setSelectedId}
        itemIcon={<ApiOutlined />}
        itemNameKey="name"
        isItem={isItem}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
        createItem={() => createConfig({ name: '新配置', baseUrl: '', apiKey: '', modelName: '' })}
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
            <Form.Item label="API Base URL">
              <AutoComplete
                value={selectedConfig.baseUrl}
                onChange={(v) => updateConfig(selectedConfig.id, { baseUrl: v })}
                options={BASE_URL_PRESETS}
                placeholder="选择或输入 API Base URL"
              />
            </Form.Item>
            <Form.Item label="API Key">
              <Input.Password
                value={selectedConfig.apiKey}
                onChange={(e) => updateConfig(selectedConfig.id, { apiKey: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="模型名称">
              <AutoComplete
                value={selectedConfig.modelName}
                onChange={(v) => updateConfig(selectedConfig.id, { modelName: v })}
                options={modelOptions.map((m) => ({ value: m, label: m }))}
                placeholder="选择或输入模型名称"
                onFocus={() => handleFetchModels(selectedConfig)}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item label="模型配置">
              <Select
                value={selectedConfig.modelConfigId}
                onChange={(v) => updateConfig(selectedConfig.id, { modelConfigId: v })}
                allowClear
                placeholder="使用默认模型配置"
                options={modelConfigs.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>
            <Form.Item>
              <Flex justify="space-between">
                <Space>
                  <Button
                    type={defaultLLMId === selectedConfig.id ? 'primary' : 'default'}
                    onClick={() =>
                      setDefaultLLMId(
                        defaultLLMId === selectedConfig.id ? undefined : selectedConfig.id
                      )
                    }
                  >
                    {defaultLLMId === selectedConfig.id ? '已设为默认' : '设为默认'}
                  </Button>
                  <Button onClick={() => handleCopyAsText(selectedConfig)}>
                    复制为文本
                  </Button>
                </Space>
                <Button onClick={() => handleTest(selectedConfig)} loading={testing}>
                  测试连接
                </Button>
              </Flex>
            </Form.Item>
          </Form>
        ) : (
          <Empty description="选择或创建配置" />
        )}
      </div>
    </Flex>
  )
}

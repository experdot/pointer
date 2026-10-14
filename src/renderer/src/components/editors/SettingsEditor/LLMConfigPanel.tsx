import React, { useState } from 'react'
import { Form, Button, Input, Flex, Empty, Space, App, AutoComplete } from 'antd'
import { ApiOutlined } from '@ant-design/icons'
import { useSettings, useLLMConfigs } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import { query } from '../../../runtime/client'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useDraftField } from '../../../hooks/useDraftField'
import type { LLMConfig, ConfigFolder } from '@renderer/types/shared'

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
    clearFolder,
    toggleFolderExpanded
  } = useLLMConfigs()
  const { defaultLLMId, setDefaultLLMId } = useSettings()
  const { message } = App.useApp()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)
  const [testing, setTesting] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelOptionsMap, setModelOptionsMap] = useState<Record<string, string[]>>({})

  const selectedConfig = items.find((c) => c.id === selectedId)
  const modelOptions = selectedId ? modelOptionsMap[selectedId] || [] : []

  const isItem = (item: LLMConfig | ConfigFolder): item is LLMConfig => item.kind === 'item'

  // 文本字段用本地草稿：中文输入法组词期间不被内核回推覆盖
  const nameField = useDraftField(selectedConfig?.name ?? '', (next) =>
    selectedConfig ? updateConfig(selectedConfig.id, { name: next }) : undefined
  )
  const baseUrlField = useDraftField(selectedConfig?.baseUrl ?? '', (next) =>
    selectedConfig ? updateConfig(selectedConfig.id, { baseUrl: next }) : undefined
  )
  const modelNameField = useDraftField(selectedConfig?.modelName ?? '', (next) =>
    selectedConfig ? updateConfig(selectedConfig.id, { modelName: next }) : undefined
  )

  const handleTest = async (config: LLMConfig): Promise<void> => {
    setTesting(true)
    try {
      const result = await query('ai.test', { llmId: config.id })
      if (result.ok) {
        message.success('连接成功')
      } else {
        message.error(result.message || '连接失败')
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
      const result = await query('ai.models', { llmId: config.id })
      if (result.models.length > 0) {
        setModelOptionsMap((prev) => ({ ...prev, [config.id]: result.models }))
      } else if (result.error) {
        message.error(result.error)
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
API Key: ${config.hasApiKey ? '(已配置)' : '(未配置)'}
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
        createItem={(inFolderId) =>
          createConfig({ name: '新配置', baseUrl: '', modelName: '' }, undefined, inFolderId)
        }
        updateItem={updateConfig}
        deleteItem={deleteConfig}
        copyItem={copyConfig}
        createFolder={(name, inFolderId) => createFolder(name, undefined, inFolderId)}
        updateFolder={updateFolder}
        deleteFolder={deleteFolder}
        clearFolder={clearFolder}
        toggleFolderExpanded={toggleFolderExpanded}
        defaultItemId={defaultLLMId}
        emptyText="暂无配置"
        addItemText="新建配置"
      />

      <div className="settings-config-detail">
        {selectedConfig ? (
          <Form layout="vertical" key={selectedConfig.id}>
            <Form.Item label="名称">
              <Input
                value={nameField.value}
                onChange={(e) => nameField.setValue(e.target.value)}
                onFocus={nameField.handlers.onFocus}
                onBlur={nameField.handlers.onBlur}
                onCompositionStart={nameField.handlers.onCompositionStart}
                onCompositionEnd={nameField.handlers.onCompositionEnd}
              />
            </Form.Item>
            <Form.Item label="API Base URL">
              <AutoComplete
                value={baseUrlField.value}
                onChange={(v) => baseUrlField.setValue(v)}
                onFocus={baseUrlField.handlers.onFocus}
                onBlur={baseUrlField.handlers.onBlur}
                options={BASE_URL_PRESETS}
                placeholder="选择或输入 API Base URL"
              />
            </Form.Item>
            <Form.Item label="API Key">
              <Input.Password
                placeholder={selectedConfig.hasApiKey ? '已配置，输入以覆盖' : '尚未配置'}
                onBlur={async (event) => {
                  const value = event.target.value.trim()
                  if (!value) return
                  await useSettingsStore.getState().setApiKey(selectedConfig.id, value)
                  event.target.value = ''
                  message.success('密钥已加密保存')
                }}
              />
            </Form.Item>
            <Form.Item label="模型名称">
              <AutoComplete
                value={modelNameField.value}
                onChange={(v) => modelNameField.setValue(v)}
                options={modelOptions.map((m) => ({ value: m, label: m }))}
                placeholder="选择或输入模型名称"
                onFocus={() => {
                  modelNameField.handlers.onFocus()
                  handleFetchModels(selectedConfig)
                }}
                onBlur={modelNameField.handlers.onBlur}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
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
                  <Button onClick={() => handleCopyAsText(selectedConfig)}>复制为文本</Button>
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

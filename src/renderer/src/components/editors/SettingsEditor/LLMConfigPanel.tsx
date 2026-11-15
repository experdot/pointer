import { t, useI18n } from '@renderer/i18n'
import React, { useCallback, useState } from 'react'
import { Form, Button, Input, Flex, Empty, Space, App, AutoComplete, Tooltip } from 'antd'
import { ApiOutlined, CopyOutlined } from '@ant-design/icons'
import { useSettings, useLLMConfigs } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import { query } from '../../../runtime/client'
import { useDraftField } from '../../../hooks/useDraftField'
import { useSettingsStore } from '../../../stores/settingsStore'
import type { LLMConfig, ConfigFolder } from '@renderer/types/shared'

function getBaseUrlPresets(): { value: string; label: string }[] {
  return [
    { value: 'https://api.openai.com/v1', label: 'OpenAI' },
    { value: 'https://openrouter.ai/api/v1', label: 'OpenRouter' },
    { value: 'http://localhost:11434/v1', label: t('config.ollamaLocal') }
  ]
}

export function LLMConfigPanel(): React.JSX.Element {
  useI18n()

  const {
    items,
    folders,
    moveNode,
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

  // 稳定引用：内联箭头会让 ConfigTree 里的 treeData useMemo 每次失效
  const isItem = useCallback(
    (item: LLMConfig | ConfigFolder): item is LLMConfig => item.kind === 'item',
    []
  )

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
      await useSettingsStore.getState().flush()
      const result = await query('ai.test', { llmId: config.id })
      if (result.ok) {
        message.success(t('config.connected'))
      } else {
        message.error(result.message || t('config.connectionFailed'))
      }
    } catch {
      message.error(t('config.testFailed'))
    } finally {
      setTesting(false)
    }
  }

  const handleFetchModels = async (config: LLMConfig): Promise<void> => {
    if (fetchingModels) return
    setFetchingModels(true)
    try {
      await useSettingsStore.getState().flush()
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
    const text = t('config.copyLlmText', {
      v0: String(config.name),
      v1: String(config.baseUrl),
      v2: String(config.apiKey),
      v3: String(config.modelName)
    })
    navigator.clipboard.writeText(text)
    message.success(t('common.copiedClipboard'))
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
        moveNode={moveNode}
        createItem={(inFolderId) =>
          createConfig(
            { name: t('config.newName'), baseUrl: '', modelName: '' },
            undefined,
            inFolderId
          )
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
        emptyText={t('config.empty')}
        addItemText={t('config.create')}
      />

      <div className="settings-config-detail">
        {selectedConfig ? (
          <Form layout="vertical" key={selectedConfig.id}>
            <Form.Item label={t('common.name')}>
              <Input
                aria-label={t('config.name')}
                value={nameField.value}
                onChange={(e) => nameField.setValue(e.target.value)}
                onFocus={nameField.handlers.onFocus}
                onBlur={nameField.handlers.onBlur}
                onCompositionStart={nameField.handlers.onCompositionStart}
                onCompositionEnd={nameField.handlers.onCompositionEnd}
              />
            </Form.Item>
            <Form.Item label={t('config.baseUrl')}>
              <AutoComplete
                aria-label={t('config.baseUrl')}
                value={baseUrlField.value}
                onChange={(v) => baseUrlField.setValue(v)}
                onFocus={baseUrlField.handlers.onFocus}
                onBlur={baseUrlField.handlers.onBlur}
                options={getBaseUrlPresets()}
                placeholder={t('config.baseUrlPlaceholder')}
              />
            </Form.Item>
            <Form.Item label={t('config.apiKey')}>
              <Input.Password
                aria-label={t('config.apiKey')}
                value={selectedConfig.apiKey}
                onChange={(e) => updateConfig(selectedConfig.id, { apiKey: e.target.value })}
              />
            </Form.Item>
            <Form.Item label={t('config.modelName')}>
              <AutoComplete
                aria-label={t('config.modelName')}
                value={modelNameField.value}
                onChange={(v) => modelNameField.setValue(v)}
                options={modelOptions.map((m) => ({ value: m, label: m }))}
                placeholder={t('config.modelNamePlaceholder')}
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
                    {defaultLLMId === selectedConfig.id
                      ? t('config.isDefault')
                      : t('config.setDefault')}
                  </Button>
                  <Tooltip title={t('config.copyText')}>
                    <Button
                      aria-label={t('config.copyText')}
                      icon={<CopyOutlined />}
                      onClick={() => handleCopyAsText(selectedConfig)}
                    />
                  </Tooltip>
                </Space>
                <Button onClick={() => handleTest(selectedConfig)} loading={testing}>
                  {t('config.test')}
                </Button>
              </Flex>
            </Form.Item>
          </Form>
        ) : (
          <Empty description={t('config.selectOrCreate')} />
        )}
      </div>
    </Flex>
  )
}

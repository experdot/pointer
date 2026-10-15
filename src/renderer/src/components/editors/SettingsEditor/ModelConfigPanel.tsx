import React, { useCallback, useState } from 'react'
import { Form, Button, Input, InputNumber, Flex, Empty, Slider, Space, App } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useSettings, useModelConfigs } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import { useDraftField } from '../../../hooks/useDraftField'
import type { ModelConfig, ConfigFolder } from '@renderer/types/shared'

const { TextArea } = Input

export function ModelConfigPanel(): React.JSX.Element {
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
  } = useModelConfigs()
  const { defaultModelConfigId, setDefaultModelConfigId } = useSettings()
  const { message } = App.useApp()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)

  const selectedConfig = items.find((c) => c.id === selectedId)

  // 稳定引用：内联箭头会让 ConfigTree 里的 treeData useMemo 每次失效
  const isItem = useCallback(
    (item: ModelConfig | ConfigFolder): item is ModelConfig => item.kind === 'item',
    []
  )

  // 文本字段用本地草稿，避免中文输入法组词期间被内核回推覆盖
  const nameField = useDraftField(selectedConfig?.name ?? '', (next) =>
    selectedConfig ? updateConfig(selectedConfig.id, { name: next }) : undefined
  )
  const promptField = useDraftField(selectedConfig?.systemPrompt ?? '', (next) =>
    selectedConfig ? updateConfig(selectedConfig.id, { systemPrompt: next }) : undefined
  )

  const handleCopyAsText = (config: ModelConfig): void => {
    const text = `名称: ${config.name}
系统提示词: ${config.systemPrompt || '(无)'}
Temperature: ${config.temperature}
Top P: ${config.topP}`
    navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  }

  return (
    <Flex className="settings-config-panel" gap={16}>
      <ConfigTree<ModelConfig>
        items={items}
        folders={folders}
        selectedId={selectedId}
        onSelect={setSelectedId}
        itemIcon={<RobotOutlined />}
        itemNameKey="name"
        isItem={isItem}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
        createItem={(inFolderId) =>
          createConfig(
            { name: '新配置', systemPrompt: '', temperature: 0.7, topP: 1 },
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
        defaultItemId={defaultModelConfigId}
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
            <Form.Item label="系统提示词">
              <TextArea
                value={promptField.value}
                onChange={(e) => promptField.setValue(e.target.value)}
                onFocus={promptField.handlers.onFocus}
                onBlur={promptField.handlers.onBlur}
                onCompositionStart={promptField.handlers.onCompositionStart}
                onCompositionEnd={promptField.handlers.onCompositionEnd}
                rows={4}
              />
            </Form.Item>
            <Form.Item
              label="Temperature"
              tooltip="控制输出的随机性。值越高，回复越多样化；值越低，回复越确定和集中。"
            >
              <Flex gap={16} align="center">
                <Slider
                  style={{ flex: 1 }}
                  value={selectedConfig.temperature}
                  onChange={(v) => updateConfig(selectedConfig.id, { temperature: v })}
                  min={0}
                  max={2}
                  step={0.1}
                  marks={{ 0: '0', 0.5: '0.5', 1: '1', 1.5: '1.5', 2: '2' }}
                />
                <InputNumber
                  style={{ width: 80 }}
                  value={selectedConfig.temperature}
                  onChange={(v) => updateConfig(selectedConfig.id, { temperature: v ?? 0.7 })}
                  min={0}
                  max={2}
                  step={0.1}
                />
              </Flex>
            </Form.Item>
            <Form.Item
              label="Top P"
              tooltip="核采样参数。限制模型只从累积概率达到该值的词中选择，值越小输出越保守。"
            >
              <Flex gap={16} align="center">
                <Slider
                  style={{ flex: 1 }}
                  value={selectedConfig.topP}
                  onChange={(v) => updateConfig(selectedConfig.id, { topP: v })}
                  min={0}
                  max={1}
                  step={0.1}
                  marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
                />
                <InputNumber
                  style={{ width: 80 }}
                  value={selectedConfig.topP}
                  onChange={(v) => updateConfig(selectedConfig.id, { topP: v ?? 1 })}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Flex>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type={defaultModelConfigId === selectedConfig.id ? 'primary' : 'default'}
                  onClick={() =>
                    setDefaultModelConfigId(
                      defaultModelConfigId === selectedConfig.id ? undefined : selectedConfig.id
                    )
                  }
                >
                  {defaultModelConfigId === selectedConfig.id ? '已设为默认' : '设为默认'}
                </Button>
                <Button onClick={() => handleCopyAsText(selectedConfig)}>复制为文本</Button>
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

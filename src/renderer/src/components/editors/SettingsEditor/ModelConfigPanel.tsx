import React, { useState } from 'react'
import { Form, Button, Input, InputNumber, Flex, Empty, Slider, Space, App } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useSettings, useModelConfigs } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import type { ModelConfig, ConfigFolder } from '../../../types/type'

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
    toggleFolderExpanded
  } = useModelConfigs()
  const { defaultModelConfigId, setDefaultModelConfigId } = useSettings()
  const { message } = App.useApp()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)

  const selectedConfig = items.find((c) => c.id === selectedId)

  const isItem = (item: ModelConfig | ConfigFolder): item is ModelConfig => item.type !== 'folder'

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
        createItem={() =>
          createConfig({ type: 'item', name: '新配置', systemPrompt: '', temperature: 0.7, topP: 1 })
        }
        updateItem={updateConfig}
        deleteItem={deleteConfig}
        copyItem={copyConfig}
        createFolder={createFolder}
        updateFolder={updateFolder}
        deleteFolder={deleteFolder}
        toggleFolderExpanded={toggleFolderExpanded}
        defaultItemId={defaultModelConfigId}
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
            <Form.Item label="系统提示词">
              <TextArea
                value={selectedConfig.systemPrompt}
                onChange={(e) => updateConfig(selectedConfig.id, { systemPrompt: e.target.value })}
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

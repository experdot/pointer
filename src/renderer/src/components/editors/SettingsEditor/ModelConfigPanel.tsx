import React, { useState } from 'react'
import { Form, Button, Input, InputNumber, Flex, Empty, Space } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useSettings, useModelConfigs } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import type { ModelConfig, ConfigFolder } from '../../../types/type'

const { TextArea } = Input

export function ModelConfigPanel(): React.JSX.Element {
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
  } = useModelConfigs()
  const { defaultModelConfigId, setDefaultModelConfigId } = useSettings()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)

  const selectedConfig = items.find((c) => c.id === selectedId)

  const isItem = (item: ModelConfig | ConfigFolder): item is ModelConfig => 'systemPrompt' in item

  return (
    <Flex className="settings-config-panel" gap={16}>
      <ConfigTree<ModelConfig>
        items={items}
        folders={folders}
        expandedKeys={expandedKeys}
        selectedId={selectedId}
        onSelect={setSelectedId}
        itemIcon={<RobotOutlined />}
        itemNameKey="name"
        isItem={isItem}
        getItemsInFolder={getItemsInFolder}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
        createItem={() =>
          createConfig({ name: '新配置', systemPrompt: '', temperature: 0.7, topP: 1 })
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
            <Space>
              <Form.Item label="Temperature">
                <InputNumber
                  value={selectedConfig.temperature}
                  onChange={(v) => updateConfig(selectedConfig.id, { temperature: v ?? 0.7 })}
                  min={0}
                  max={2}
                  step={0.1}
                />
              </Form.Item>
              <Form.Item label="Top P">
                <InputNumber
                  value={selectedConfig.topP}
                  onChange={(v) => updateConfig(selectedConfig.id, { topP: v ?? 1 })}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Form.Item>
            </Space>
            <Form.Item>
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
            </Form.Item>
          </Form>
        ) : (
          <Empty description="选择或创建配置" />
        )}
      </div>
    </Flex>
  )
}

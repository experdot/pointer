import React, { useState } from 'react'
import { Form, Button, Input, InputNumber, Flex, Empty, Modal, Space } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSettings, useModelConfigs } from '../../../hooks/useSettings'
import { useConfirmDialog } from '../../common/ConfirmDialog'
import type { ModelConfig } from '../../../types/type'

const { TextArea } = Input

export function ModelConfigPanel(): React.JSX.Element {
  const { items, createConfig, updateConfig, deleteConfig } = useModelConfigs()
  const { defaultModelConfigId, setDefaultModelConfigId } = useSettings()
  const { showDeleteConfirm } = useConfirmDialog()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const selectedConfig = items.find((c) => c.id === selectedId)

  const handleCreate = (): void => {
    form.validateFields().then((values) => {
      const config = createConfig(values)
      setSelectedId(config.id)
      setIsModalOpen(false)
      form.resetFields()
    })
  }

  const handleDelete = (config: ModelConfig): void => {
    showDeleteConfirm({
      title: `删除 "${config.name}"`,
      onOk: () => {
        deleteConfig(config.id)
        if (selectedId === config.id) {
          setSelectedId(items.find((c) => c.id !== config.id)?.id || null)
        }
      }
    })
  }

  return (
    <Flex className="settings-config-panel" gap={16}>
      <Flex className="settings-config-list" vertical gap={8}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)} block>
          添加配置
        </Button>
        {items.map((config) => (
          <Flex
            key={config.id}
            className={`settings-config-item ${selectedId === config.id ? 'selected' : ''}`}
            justify="space-between"
            align="center"
            onClick={() => setSelectedId(config.id)}
          >
            <span className="settings-config-item-name">{config.name}</span>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(config)
              }}
            />
          </Flex>
        ))}
        {items.length === 0 && <Empty description="暂无配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </Flex>

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

      <Modal
        title="新建模型配置"
        open={isModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ temperature: 0.7, topP: 1 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="systemPrompt" label="系统提示词" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="temperature" label="Temperature">
            <InputNumber min={0} max={2} step={0.1} />
          </Form.Item>
          <Form.Item name="topP" label="Top P">
            <InputNumber min={0} max={1} step={0.1} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  )
}

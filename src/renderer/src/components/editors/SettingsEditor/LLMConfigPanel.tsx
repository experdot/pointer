import React, { useState } from 'react'
import { Form, Button, Input, Flex, Empty, Modal, Space, App } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSettings, useLLMConfigs } from '../../../hooks/useSettings'
import { useConfirmDialog } from '../../common/ConfirmDialog'
import type { LLMConfig } from '../../../types/type'

export function LLMConfigPanel(): React.JSX.Element {
  const { items, createConfig, updateConfig, deleteConfig } = useLLMConfigs()
  const { defaultLLMId, setDefaultLLMId } = useSettings()
  const { showDeleteConfirm } = useConfirmDialog()
  const { message } = App.useApp()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [testing, setTesting] = useState(false)
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

  const handleDelete = (config: LLMConfig): void => {
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
          <Form layout="vertical" initialValues={selectedConfig} key={selectedConfig.id}>
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

      <Modal
        title="新建 LLM 配置"
        open={isModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="apiHost" label="API Host" rules={[{ required: true }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="gpt-4" />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  )
}

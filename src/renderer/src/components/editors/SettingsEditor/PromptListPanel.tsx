import React, { useState } from 'react'
import { Form, Button, Input, Flex, Empty, Modal } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { usePromptLists } from '../../../hooks/useSettings'
import { useConfirmDialog } from '../../common/ConfirmDialog'
import type { PromptListConfig } from '../../../types/type'

const { TextArea } = Input

export function PromptListPanel(): React.JSX.Element {
  const { items, createConfig, updateConfig, deleteConfig } = usePromptLists()
  const { showDeleteConfirm } = useConfirmDialog()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const selectedConfig = items.find((c) => c.id === selectedId)

  const handleCreate = (): void => {
    form.validateFields().then((values) => {
      const config = createConfig({
        ...values,
        prompts: values.prompts?.split('\n').filter((p: string) => p.trim()) || []
      })
      setSelectedId(config.id)
      setIsModalOpen(false)
      form.resetFields()
    })
  }

  const handleDelete = (config: PromptListConfig): void => {
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
          添加列表
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
        {items.length === 0 && <Empty description="暂无列表" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
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
            <Form.Item label="描述">
              <Input
                value={selectedConfig.description}
                onChange={(e) => updateConfig(selectedConfig.id, { description: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="提示词列表（每行一个）">
              <TextArea
                value={selectedConfig.prompts.join('\n')}
                onChange={(e) =>
                  updateConfig(selectedConfig.id, {
                    prompts: e.target.value.split('\n').filter((p) => p.trim())
                  })
                }
                rows={10}
              />
            </Form.Item>
          </Form>
        ) : (
          <Empty description="选择或创建列表" />
        )}
      </div>

      <Modal
        title="新建提示词列表"
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
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Form.Item name="prompts" label="提示词列表（每行一个）">
            <TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  )
}

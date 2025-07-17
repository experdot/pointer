import React, { useState, useEffect } from 'react'
import {
  Card,
  List,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  Tag,
  Empty,
  Dropdown,
  App
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  StarOutlined,
  StarFilled,
  MoreOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { LLMConfig } from '../../types/type'
import { v4 as uuidv4 } from 'uuid'
import { createAIService } from '../../services/aiService'
import { useSettings } from '../../store/hooks/useSettings'

const { Text } = Typography

interface LLMConfigFormProps {
  open: boolean
  config?: LLMConfig
  onSave: (config: LLMConfig) => void
  onCancel: () => void
}

function LLMConfigForm({ open, config, onSave, onCancel }: LLMConfigFormProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()

  // 当 config 变化时，更新表单值
  useEffect(() => {
    if (open) {
      if (config) {
        form.setFieldsValue(config)
      } else {
        form.resetFields()
      }
    }
  }, [open, config, form])

  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()

      const newConfig: LLMConfig = {
        id: config?.id || uuidv4(),
        name: values.name,
        apiHost: values.apiHost,
        apiKey: values.apiKey,
        modelName: values.modelName,
        isDefault: config?.isDefault || false,
        createdAt: config?.createdAt || Date.now()
      }

      onSave(newConfig)
      form.resetFields()
    } catch (error) {
      message.error('请检查输入内容')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const tempConfig: LLMConfig = {
        id: 'temp',
        name: values.name,
        apiHost: values.apiHost,
        apiKey: values.apiKey,
        modelName: values.modelName,
        isDefault: false,
        createdAt: Date.now()
      }

      const aiService = createAIService(tempConfig)
      const isConnected = await aiService.testConnection()

      console.log('isConnected', isConnected)
      if (isConnected) {
        message.success('连接测试成功')
      } else {
        message.error('连接测试失败，请检查配置')
      }
    } catch (error) {
      message.error('连接测试失败，请检查配置')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={config ? '编辑LLM配置' : '新增LLM配置'}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button
          key="test"
          icon={<ThunderboltOutlined />}
          onClick={testConnection}
          loading={loading}
        >
          测试连接
        </Button>,
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={loading}>
          {config ? '更新' : '保存'}
        </Button>
      ]}
      width={500}
    >
      <Form form={form} layout="vertical" initialValues={config}>
        <Form.Item
          name="name"
          label="配置名称"
          rules={[{ required: true, message: '请输入配置名称' }]}
        >
          <Input placeholder="例如: OpenAI GPT-4" />
        </Form.Item>

        <Form.Item
          name="apiHost"
          label="API Host"
          rules={[{ required: true, message: '请输入API Host' }]}
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>

        <Form.Item
          name="apiKey"
          label="API Key"
          rules={[{ required: true, message: '请输入API Key' }]}
        >
          <Input.Password placeholder="请输入API Key" />
        </Form.Item>

        <Form.Item
          name="modelName"
          label="模型名称"
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          <Input placeholder="gpt-4" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function LLMSettings() {
  const { settings, addLLMConfig, updateLLMConfig, deleteLLMConfig, setDefaultLLM } = useSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<LLMConfig | undefined>()
  const { message, modal } = App.useApp()

  const handleSaveConfig = (config: LLMConfig) => {
    const existingConfig = settings.llmConfigs?.find((c) => c.id === config.id)

    if (existingConfig) {
      updateLLMConfig(config.id, config)
      message.success('配置已更新')
    } else {
      addLLMConfig(config)
      message.success('配置已添加')
    }

    setModalOpen(false)
    setEditingConfig(undefined)
  }

  const handleDeleteConfig = (config: LLMConfig) => {
    const currentConfigs = settings.llmConfigs || []
    const isDefaultConfig = config.isDefault
    const isLastConfig = currentConfigs.length === 1

    const title = isDefaultConfig ? '删除默认配置' : '删除配置'
    let content = `确定要删除配置 "${config.name}" 吗？`

    if (isDefaultConfig && !isLastConfig) {
      content += '\n\n删除后，系统将自动选择另一个配置作为默认配置。'
    } else if (isLastConfig) {
      content += '\n\n这是最后一个配置，删除后您将无法使用AI功能。'
    }

    modal.confirm({
      title,
      content,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        deleteLLMConfig(config.id)
        message.success('配置已删除')
      }
    })
  }

  const handleCopyConfig = (config: LLMConfig) => {
    const currentConfigs = settings.llmConfigs || []
    const hasDefaultConfig = currentConfigs.some((c) => c.isDefault)

    const newConfig: LLMConfig = {
      ...config,
      id: uuidv4(),
      name: `${config.name} (副本)`,
      isDefault: !hasDefaultConfig, // 如果没有默认配置，则设为默认
      createdAt: Date.now()
    }

    addLLMConfig(newConfig)
    message.success('配置已复制')
  }

  const handleSetDefault = (id: string) => {
    setDefaultLLM(id)
    message.success('已设为默认配置')
  }

  const getDropdownItems = (config: LLMConfig) => [
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => {
        setEditingConfig(config)
        setModalOpen(true)
      }
    },
    {
      key: 'copy',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: () => handleCopyConfig(config)
    },
    {
      key: 'setDefault',
      label: config.isDefault ? '已是默认' : '设为默认',
      icon: config.isDefault ? <StarFilled /> : <StarOutlined />,
      disabled: config.isDefault,
      onClick: () => handleSetDefault(config.id)
    },
    {
      type: 'divider' as const
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDeleteConfig(config)
    }
  ]

  return (
    <Card
      size="small"
      title="LLM配置管理"
      bordered={false}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingConfig(undefined)
            setModalOpen(true)
          }}
        >
          新增配置
        </Button>
      }
    >
      {!settings.llmConfigs?.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无LLM配置">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingConfig(undefined)
              setModalOpen(true)
            }}
          >
            创建第一个配置
          </Button>
        </Empty>
      ) : (
        <List
          dataSource={settings.llmConfigs}
          renderItem={(config) => (
            <List.Item
              actions={[
                <Dropdown key="more" menu={{ items: getDropdownItems(config) }} trigger={['click']}>
                  <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{config.name}</Text>
                    {config.isDefault && (
                      <Tag color="gold" icon={<StarFilled />}>
                        默认
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Space direction="vertical" size="small">
                    <Text type="secondary">Host: {config.apiHost}</Text>
                    <Text type="secondary">Model: {config.modelName}</Text>
                    <Text type="secondary">API Key: {config.apiKey.slice(0, 8)}...</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      <LLMConfigForm
        open={modalOpen}
        config={editingConfig}
        onSave={handleSaveConfig}
        onCancel={() => {
          setModalOpen(false)
          setEditingConfig(undefined)
        }}
      />
    </Card>
  )
}

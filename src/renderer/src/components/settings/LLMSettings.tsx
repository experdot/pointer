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
  Select,
  App,
  Divider
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
import { useSettingsStore } from '../../stores/settingsStore'

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
  const [modelLoading, setModelLoading] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const { message } = App.useApp()
  const { settings } = useSettingsStore()

  // 当 config 变化时，更新表单值
  useEffect(() => {
    if (open) {
      if (config) {
        form.setFieldsValue(config)
      } else {
        form.resetFields()
      }
      setModels([])
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

  const fetchModels = async () => {
    try {
      const apiHost = form.getFieldValue('apiHost')
      const apiKey = form.getFieldValue('apiKey')

      if (!apiHost || !apiKey) {
        message.warning('请先输入 API Host 和 API Key')
        return
      }

      setModelLoading(true)
      const result = await window.api.ai.getModels({
        apiHost,
        apiKey,
        modelName: ''
      })

      if (result.success && result.models) {
        setModels(result.models)
        message.success(`成功获取 ${result.models.length} 个模型`)
      } else {
        message.error(result.error || '获取模型列表失败')
        setModels([])
      }
    } catch (error) {
      message.error('获取模型列表失败')
      setModels([])
    } finally {
      setModelLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const result = await window.api.ai.testConnection({
        apiHost: values.apiHost,
        apiKey: values.apiKey,
        modelName: values.modelName
      })

      if (result.success) {
        message.success('连接测试成功')
      } else {
        message.error(result.error || '连接测试失败，请检查配置')
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
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
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
      <Form form={form} layout="vertical">
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
          extra={
            <Button
              type="link"
              size="small"
              onClick={fetchModels}
              loading={modelLoading}
              style={{ padding: 0 }}
            >
              从服务器获取模型列表
            </Button>
          }
        >
          {models.length > 0 ? (
            <Select
              placeholder="选择或输入模型名称"
              showSearch
              allowClear
              loading={modelLoading}
              options={models.map((model) => ({ label: model, value: model }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          ) : (
            <Input placeholder="请输入模型名称，例如: gpt-4" />
          )}
        </Form.Item>

        <Form.Item
          name="modelConfigId"
          label="关联模型配置"
          help="选择要关联的模型配置，如不选择则使用默认配置"
        >
          <Select placeholder="选择模型配置（可选）" allowClear>
            {settings.modelConfigs.map((modelConfig) => (
              <Select.Option key={modelConfig.id} value={modelConfig.id}>
                {modelConfig.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function LLMSettings() {
  const { settings, addLLMConfig, updateLLMConfig, deleteLLMConfig, setDefaultLLM } =
    useSettingsStore()
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
    const isDefaultConfig = settings.defaultLLMId === config.id
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
    const hasDefaultConfig = settings.defaultLLMId

    const newConfig: LLMConfig = {
      ...config,
      id: uuidv4(),
      name: `${config.name} (副本)`,
      createdAt: Date.now()
    }

    addLLMConfig(newConfig)

    // 如果没有默认配置，则将新配置设为默认
    if (!hasDefaultConfig) {
      setDefaultLLM(newConfig.id)
    }

    message.success('配置已复制')
  }

  const handleSetDefault = (id: string) => {
    setDefaultLLM(id)
    message.success('已设为默认配置')
  }

  const getDropdownItems = (config: LLMConfig) => {
    const isDefault = settings.defaultLLMId === config.id

    return [
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
        label: isDefault ? '已是默认' : '设为默认',
        icon: isDefault ? <StarFilled /> : <StarOutlined />,
        disabled: isDefault,
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
  }

  return (
    <Card
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
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>默认模型：</Text>
            <Select
              value={settings.defaultLLMId}
              onChange={handleSetDefault}
              style={{ width: 200, marginLeft: 8 }}
              placeholder="选择默认模型"
            >
              {settings.llmConfigs.map((config) => (
                <Select.Option key={config.id} value={config.id}>
                  {config.name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <Divider />

          <List
            dataSource={settings.llmConfigs}
            renderItem={(config) => (
              <List.Item
                actions={[
                  <Dropdown
                    key="more"
                    menu={{ items: getDropdownItems(config) }}
                    trigger={['click']}
                  >
                    <Button type="text" icon={<MoreOutlined />} />
                  </Dropdown>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{config.name}</Text>
                      {settings.defaultLLMId === config.id && (
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
                      <Text type="secondary">
                        关联配置:{' '}
                        {config.modelConfigId
                          ? settings.modelConfigs.find((mc) => mc.id === config.modelConfigId)
                              ?.name || '已删除'
                          : '使用默认配置'}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </div>
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

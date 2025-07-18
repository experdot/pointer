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
  Slider,
  Row,
  Col,
  Divider
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  StarOutlined,
  StarFilled,
  MoreOutlined
} from '@ant-design/icons'
import { ModelConfig } from '../../types/type'
import { v4 as uuidv4 } from 'uuid'
import { useSettingsStore } from '../../stores/settingsStore'

const { Text } = Typography
const { TextArea } = Input

interface ModelConfigFormProps {
  open: boolean
  config?: ModelConfig
  onSave: (config: ModelConfig) => void
  onCancel: () => void
}

function ModelConfigForm({ open, config, onSave, onCancel }: ModelConfigFormProps) {
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
        // 设置默认值
        form.setFieldsValue({
          systemPrompt: '你是一个有用的AI助手，请提供准确、有帮助的回答。',
          temperature: 0.7,
          topP: 0.9
        })
      }
    }
  }, [open, config, form])

  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()

      const newConfig: ModelConfig = {
        id: config?.id || uuidv4(),
        name: values.name,
        systemPrompt: values.systemPrompt,
        temperature: values.temperature,
        topP: values.topP,
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

  return (
    <Modal
      title={config ? '编辑模型配置' : '新增模型配置'}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={loading}>
          {config ? '更新' : '保存'}
        </Button>
      ]}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="配置名称"
          rules={[{ required: true, message: '请输入配置名称' }]}
        >
          <Input placeholder="例如: 创意写作助手" />
        </Form.Item>

        <Form.Item
          name="systemPrompt"
          label="系统提示词"
          rules={[{ required: true, message: '请输入系统提示词' }]}
        >
          <TextArea
            autoSize={{ minRows: 3, maxRows: 10 }}
            placeholder="输入系统提示词，定义AI的角色和行为..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="temperature"
              label="温度 (Temperature)"
              rules={[{ required: true, message: '请设置温度值' }]}
            >
              <Slider
                min={0}
                max={2}
                step={0.1}
                marks={{
                  0: '0',
                  0.5: '0.5',
                  1: '1',
                  1.5: '1.5',
                  2: '2'
                }}
                tooltip={{ formatter: (value) => `${value}` }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="topP"
              label="Top P"
              rules={[{ required: true, message: '请设置Top P值' }]}
            >
              <Slider
                min={0}
                max={1}
                step={0.1}
                marks={{
                  0: '0',
                  0.5: '0.5',
                  1: '1'
                }}
                tooltip={{ formatter: (value) => `${value}` }}
              />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <strong>参数说明：</strong>
            <br />
            • Temperature: 控制输出的随机性，值越高越有创意，值越低越确定
            <br />• Top P: 控制词汇选择的多样性，通常设置为0.9左右
          </Text>
        </div>
      </Form>
    </Modal>
  )
}

export default function ModelConfigSettings() {
  const { settings, addModelConfig, updateModelConfig, deleteModelConfig, setDefaultModelConfig } =
    useSettingsStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ModelConfig | undefined>()
  const { message, modal } = App.useApp()

  const handleSaveConfig = (config: ModelConfig) => {
    const existingConfig = settings.modelConfigs?.find((c) => c.id === config.id)

    if (existingConfig) {
      updateModelConfig(config.id, config)
      message.success('配置已更新')
    } else {
      addModelConfig(config)
      message.success('配置已添加')
    }

    setModalOpen(false)
    setEditingConfig(undefined)
  }

  const handleDeleteConfig = (config: ModelConfig) => {
    const currentConfigs = settings.modelConfigs || []
    const isDefaultConfig = settings.defaultModelConfigId === config.id
    const isLastConfig = currentConfigs.length === 1

    const title = isDefaultConfig ? '删除默认配置' : '删除配置'
    let content = `确定要删除配置 "${config.name}" 吗？`

    if (isDefaultConfig && !isLastConfig) {
      content += '\n\n删除后，系统将自动选择另一个配置作为默认配置。'
    } else if (isLastConfig) {
      content += '\n\n这是最后一个配置，删除后将使用内置默认配置。'
    }

    modal.confirm({
      title,
      content,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        deleteModelConfig(config.id)
        message.success('配置已删除')
      }
    })
  }

  const handleCopyConfig = (config: ModelConfig) => {
    const newConfig: ModelConfig = {
      ...config,
      id: uuidv4(),
      name: `${config.name} (副本)`,
      createdAt: Date.now()
    }

    addModelConfig(newConfig)
    message.success('配置已复制')
  }

  const handleSetDefault = (id: string) => {
    setDefaultModelConfig(id)
    message.success('已设为默认配置')
  }

  const getDropdownItems = (config: ModelConfig) => {
    const isDefault = settings.defaultModelConfigId === config.id

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

  const formatSystemPrompt = (prompt: string) => {
    return prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt
  }

  return (
    <Card
      size="small"
      title="模型配置管理"
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
      {!settings.modelConfigs?.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模型配置">
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
            <Text strong>默认配置：</Text>
            <Select
              value={settings.defaultModelConfigId}
              onChange={handleSetDefault}
              style={{ width: 200, marginLeft: 8 }}
              placeholder="选择默认配置"
            >
              {settings.modelConfigs.map((config) => (
                <Select.Option key={config.id} value={config.id}>
                  {config.name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <Divider />
          <List
            dataSource={settings.modelConfigs}
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
                      {settings.defaultModelConfigId === config.id && (
                        <Tag color="gold" icon={<StarFilled />}>
                          默认
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary">
                        系统提示词: {formatSystemPrompt(config.systemPrompt)}
                      </Text>
                      <Text type="secondary">
                        温度: {config.temperature} | Top P: {config.topP}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      <ModelConfigForm
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

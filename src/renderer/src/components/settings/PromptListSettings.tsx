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
  BulbOutlined
} from '@ant-design/icons'
import { PromptListConfig } from '../../types/type'
import { v4 as uuidv4 } from 'uuid'
import { useSettingsStore } from '../../stores/settingsStore'

const { Text } = Typography
const { TextArea } = Input

interface PromptListFormProps {
  open: boolean
  config?: PromptListConfig
  onSave: (config: PromptListConfig) => void
  onCancel: () => void
}

function PromptListForm({ open, config, onSave, onCancel }: PromptListFormProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [prompts, setPrompts] = useState<string[]>([''])
  const { message } = App.useApp()

  // 当 config 变化时，更新表单值
  useEffect(() => {
    if (open) {
      if (config) {
        form.setFieldsValue({
          name: config.name,
          description: config.description
        })
        setPrompts(config.prompts.length > 0 ? config.prompts : [''])
      } else {
        form.resetFields()
        setPrompts([''])
      }
    }
  }, [open, config, form])

  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()

      const filteredPrompts = prompts.filter((p) => p.trim().length > 0)
      if (filteredPrompts.length === 0) {
        message.error('至少需要一个提示词')
        return
      }

      const newConfig: PromptListConfig = {
        id: config?.id || uuidv4(),
        name: values.name,
        description: values.description || '',
        prompts: filteredPrompts,
        createdAt: config?.createdAt || Date.now()
      }

      onSave(newConfig)
      form.resetFields()
      setPrompts([''])
    } catch (error) {
      message.error('请检查输入内容')
    } finally {
      setLoading(false)
    }
  }

  const addPrompt = () => {
    setPrompts([...prompts, ''])
  }

  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts]
    newPrompts[index] = value
    setPrompts(newPrompts)
  }

  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      const newPrompts = prompts.filter((_, i) => i !== index)
      setPrompts(newPrompts)
    }
  }

  return (
    <Modal
      title={config ? '编辑提示词列表' : '新增提示词列表'}
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
          label="列表名称"
          rules={[{ required: true, message: '请输入列表名称' }]}
        >
          <Input placeholder="例如: 5W1H分析法" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea placeholder="描述此提示词列表的用途和特点" rows={2} />
        </Form.Item>

        <Form.Item label="提示词列表" required>
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              这些提示词会按顺序依次向AI提问
            </Text>
          </div>
          {prompts.map((prompt, index) => (
            <div key={index} style={{ display: 'flex', marginBottom: 8, alignItems: 'center' }}>
              <span
                style={{
                  marginRight: 8,
                  minWidth: 20,
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#999'
                }}
              >
                {index + 1}.
              </span>
              <Input
                value={prompt}
                onChange={(e) => updatePrompt(index, e.target.value)}
                placeholder="输入提示词内容"
                style={{ marginRight: 8 }}
              />
              <Button
                type="text"
                danger
                onClick={() => removePrompt(index)}
                disabled={prompts.length === 1}
                style={{ flexShrink: 0 }}
              >
                删除
              </Button>
            </div>
          ))}
          <Button type="dashed" onClick={addPrompt} style={{ width: '100%' }}>
            <PlusOutlined /> 添加提示词
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function PromptListSettings() {
  const { settings, addPromptList, updatePromptList, deletePromptList, setDefaultPromptList } =
    useSettingsStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<PromptListConfig | undefined>()
  const { message, modal } = App.useApp()

  const handleSaveConfig = (config: PromptListConfig) => {
    const existingConfig = settings.promptLists?.find((c) => c.id === config.id)

    if (existingConfig) {
      updatePromptList(config.id, config)
      message.success('配置已更新')
    } else {
      addPromptList(config)
      message.success('配置已添加')
    }

    setModalOpen(false)
    setEditingConfig(undefined)
  }

  const handleDeleteConfig = (config: PromptListConfig) => {
    const currentConfigs = settings.promptLists || []
    const isDefaultConfig = settings.defaultPromptListId === config.id
    const isLastConfig = currentConfigs.length === 1

    const title = isDefaultConfig ? '删除默认配置' : '删除配置'
    let content = `确定要删除提示词列表 "${config.name}" 吗？`

    if (isDefaultConfig && !isLastConfig) {
      content += '\n\n删除后，系统将自动选择另一个配置作为默认配置。'
    } else if (isLastConfig) {
      content += '\n\n这是最后一个配置，删除后您将无法使用预设提示词功能。'
    }

    modal.confirm({
      title,
      content,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        deletePromptList(config.id)
        message.success('配置已删除')
      }
    })
  }

  const handleCopyConfig = (config: PromptListConfig) => {
    const newConfig: PromptListConfig = {
      ...config,
      id: uuidv4(),
      name: `${config.name} (副本)`,
      createdAt: Date.now()
    }

    addPromptList(newConfig)
    message.success('配置已复制')
  }

  const handleSetDefault = (id: string) => {
    setDefaultPromptList(id)
    message.success('已设为默认配置')
  }

  const getDropdownItems = (config: PromptListConfig) => {
    const isDefault = settings.defaultPromptListId === config.id

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
      size="small"
      title="提示词列表管理"
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
          新增列表
        </Button>
      }
    >
      {!settings.promptLists?.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无提示词列表">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingConfig(undefined)
              setModalOpen(true)
            }}
          >
            创建第一个列表
          </Button>
        </Empty>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>默认列表：</Text>
            <Select
              value={settings.defaultPromptListId}
              onChange={handleSetDefault}
              style={{ width: 200, marginLeft: 8 }}
              placeholder="选择默认列表"
            >
              {settings.promptLists.map((config) => (
                <Select.Option key={config.id} value={config.id}>
                  {config.name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <Divider />

          <List
            dataSource={settings.promptLists}
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
                  avatar={<BulbOutlined style={{ color: '#1890ff' }} />}
                  title={
                    <Space>
                      <Text strong>{config.name}</Text>
                      {settings.defaultPromptListId === config.id && (
                        <Tag color="gold" icon={<StarFilled />}>
                          默认
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      {config.description && <Text type="secondary">{config.description}</Text>}
                      <Text type="secondary">共 {config.prompts.length} 个提示词</Text>
                      <div style={{ marginTop: 4 }}>
                        {config.prompts.slice(0, 2).map((prompt, index) => (
                          <Tag key={index} style={{ marginBottom: 4 }}>
                            {index + 1}. {prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt}
                          </Tag>
                        ))}
                        {config.prompts.length > 2 && (
                          <Tag style={{ marginBottom: 4 }}>+{config.prompts.length - 2} 更多</Tag>
                        )}
                      </div>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      <PromptListForm
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

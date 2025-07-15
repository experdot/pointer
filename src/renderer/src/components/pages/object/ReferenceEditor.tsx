import React, { useState } from 'react'
import {
  Button,
  Typography,
  Card,
  Space,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Tree,
  Tag,
  Tooltip,
  message,
  Popconfirm,
  Empty
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  ExclamationCircleOutlined,
  StarOutlined
} from '@ant-design/icons'
import { ObjectNodeReference, ObjectNode } from '../../../types'

const { Text, Title } = Typography
const { Option } = Select
const { TextArea } = Input

interface ReferenceEditorProps {
  references: ObjectNodeReference[]
  allNodes: { [nodeId: string]: ObjectNode }
  currentNodeId: string
  onSave: (references: ObjectNodeReference[]) => void
  onGenerateAI?: () => void
}

const ReferenceEditor: React.FC<ReferenceEditorProps> = ({
  references = [],
  allNodes,
  currentNodeId,
  onSave,
  onGenerateAI
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingReference, setEditingReference] = useState<ObjectNodeReference | null>(null)
  const [form] = Form.useForm()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // 引用类型配置
  const referenceTypes = [
    { value: 'dependency', label: '依赖关系', color: '#1890ff' },
    { value: 'related', label: '相关关系', color: '#52c41a' },
    { value: 'inspiration', label: '灵感来源', color: '#faad14' },
    { value: 'conflict', label: '冲突关系', color: '#f5222d' },
    { value: 'custom', label: '自定义', color: '#722ed1' }
  ]

  // 引用强度配置
  const strengthOptions = [
    { value: 'weak', label: '弱', color: '#d9d9d9' },
    { value: 'medium', label: '中', color: '#faad14' },
    { value: 'strong', label: '强', color: '#f5222d' }
  ]

  // 构建节点树数据
  const buildNodeTreeData = (nodeId: string, visited = new Set<string>()): any => {
    if (visited.has(nodeId) || nodeId === currentNodeId) return null

    const node = allNodes[nodeId]
    if (!node) return null

    visited.add(nodeId)

    const children =
      node.children?.map((childId) => buildNodeTreeData(childId, visited)).filter(Boolean) || []

    return {
      title: node.name,
      key: nodeId,
      value: nodeId,
      children
    }
  }

  // 获取根节点并构建树
  const getTreeData = () => {
    const rootNodes = Object.values(allNodes).filter((node) => !node.parentId)
    return rootNodes.map((node) => buildNodeTreeData(node.id)).filter(Boolean)
  }

  // 打开添加/编辑弹窗
  const openModal = (reference?: ObjectNodeReference) => {
    setEditingReference(reference || null)
    setIsModalVisible(true)

    if (reference) {
      form.setFieldsValue({
        nodeId: reference.id,
        type: reference.type,
        strength: reference.strength,
        description: reference.description
      })
      setSelectedNodeId(reference.id)
    } else {
      form.resetFields()
      setSelectedNodeId(null)
    }
  }

  // 关闭弹窗
  const closeModal = () => {
    setIsModalVisible(false)
    setEditingReference(null)
    form.resetFields()
    setSelectedNodeId(null)
  }

  // 处理节点选择
  const handleNodeSelect = (selectedKeys: React.Key[]) => {
    const nodeId = selectedKeys[0]?.toString()
    setSelectedNodeId(nodeId || null)
    form.setFieldsValue({ nodeId })
  }

  // 保存引用
  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      if (!selectedNodeId) {
        message.error('请选择一个引用节点')
        return
      }

      const targetNode = allNodes[selectedNodeId]
      if (!targetNode) {
        message.error('选择的节点不存在')
        return
      }

      // 检查是否已存在相同的引用
      const existingIndex = references.findIndex((ref) => ref.id === selectedNodeId)
      if (existingIndex !== -1 && !editingReference) {
        message.error('该节点已在引用列表中')
        return
      }

      const newReference: ObjectNodeReference = {
        id: selectedNodeId,
        name: targetNode.name,
        description: values.description,
        type: values.type,
        strength: values.strength,
        metadata: {
          createdAt: editingReference?.metadata?.createdAt || Date.now(),
          updatedAt: Date.now(),
          source: 'user'
        }
      }

      let newReferences = [...references]

      if (editingReference) {
        // 更新现有引用
        const index = references.findIndex((ref) => ref.id === editingReference.id)
        if (index !== -1) {
          newReferences[index] = newReference
        }
      } else {
        // 添加新引用
        newReferences.push(newReference)
      }

      onSave(newReferences)
      closeModal()
      message.success(editingReference ? '引用更新成功' : '引用添加成功')
    } catch (error) {
      console.error('保存引用失败:', error)
    }
  }

  // 删除引用
  const handleDelete = (referenceId: string) => {
    const newReferences = references.filter((ref) => ref.id !== referenceId)
    onSave(newReferences)
    message.success('引用删除成功')
  }

  // 获取引用类型配置
  const getTypeConfig = (type: string) => {
    return referenceTypes.find((t) => t.value === type) || referenceTypes[0]
  }

  // 获取强度配置
  const getStrengthConfig = (strength: string) => {
    return strengthOptions.find((s) => s.value === strength) || strengthOptions[0]
  }

  // 表格列定义
  const columns = [
    {
      title: '引用节点',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ObjectNodeReference) => (
        <Space>
          <LinkOutlined />
          <Text strong>{name}</Text>
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const config = getTypeConfig(type)
        return <Tag color={config.color}>{config.label}</Tag>
      }
    },
    {
      title: '强度',
      dataIndex: 'strength',
      key: 'strength',
      render: (strength: string) => {
        const config = getStrengthConfig(strength)
        return <Tag color={config.color}>{config.label}</Tag>
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (
        <Text ellipsis={{ tooltip: description }} style={{ maxWidth: 200 }}>
          {description || '无'}
        </Text>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: ObjectNodeReference) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          />
          <Popconfirm
            title="确定删除这个引用吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          引用关系 ({references.length})
        </Title>
        <Space>
          {onGenerateAI && (
            <Button type="dashed" size="small" icon={<StarOutlined />} onClick={onGenerateAI}>
              AI生成
            </Button>
          )}
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openModal()}>
            添加引用
          </Button>
        </Space>
      </div>

      {references.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无引用关系"
          style={{ padding: '20px 0' }}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={references}
          rowKey="id"
          size="small"
          pagination={false}
        />
      )}

      <Modal
        title={editingReference ? '编辑引用' : '添加引用'}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={closeModal}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="nodeId"
            label="选择引用节点"
            rules={[{ required: true, message: '请选择一个节点' }]}
          >
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                padding: 8,
                maxHeight: 200,
                overflow: 'auto'
              }}
            >
              <Tree
                treeData={getTreeData()}
                selectedKeys={selectedNodeId ? [selectedNodeId] : []}
                onSelect={handleNodeSelect}
                showLine
              />
            </div>
          </Form.Item>

          <Form.Item
            name="type"
            label="引用类型"
            rules={[{ required: true, message: '请选择引用类型' }]}
            initialValue="dependency"
          >
            <Select placeholder="选择引用类型">
              {referenceTypes.map((type) => (
                <Option key={type.value} value={type.value}>
                  <Tag color={type.color}>{type.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="strength"
            label="引用强度"
            rules={[{ required: true, message: '请选择引用强度' }]}
            initialValue="medium"
          >
            <Select placeholder="选择引用强度">
              {strengthOptions.map((strength) => (
                <Option key={strength.value} value={strength.value}>
                  <Tag color={strength.color}>{strength.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="引用描述">
            <TextArea
              placeholder="描述这个引用关系的作用和意义..."
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ReferenceEditor

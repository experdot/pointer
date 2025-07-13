import React, { useState } from 'react'
import { Modal, Form, Input, Button, Card, Space, Select, InputNumber, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { CrosstabMetadata, CrosstabAxisDimension, CrosstabValueDimension } from '../../../types'
import { v4 as uuidv4 } from 'uuid'

const { TextArea } = Input

interface MetadataEditorProps {
  isOpen: boolean
  metadata: CrosstabMetadata | null
  onSave: (values: CrosstabMetadata) => void
  onCancel: () => void
}

export default function MetadataEditor({
  isOpen,
  metadata,
  onSave,
  onCancel
}: MetadataEditorProps) {
  const [form] = Form.useForm()
  const [horizontalDimensions, setHorizontalDimensions] = useState<CrosstabAxisDimension[]>(
    metadata?.horizontalDimensions || []
  )
  const [verticalDimensions, setVerticalDimensions] = useState<CrosstabAxisDimension[]>(
    metadata?.verticalDimensions || []
  )
  const [valueDimensions, setValueDimensions] = useState<CrosstabValueDimension[]>(
    metadata?.valueDimensions || []
  )

  const handleSave = () => {
    form.validateFields().then((values) => {
      const newMetadata: CrosstabMetadata = {
        topic: values.topic,
        horizontalDimensions: horizontalDimensions.map((dim, index) => ({
          ...dim,
          order: index + 1
        })),
        verticalDimensions: verticalDimensions.map((dim, index) => ({
          ...dim,
          order: index + 1
        })),
        valueDimensions: valueDimensions,
        topicSuggestions: metadata?.topicSuggestions
      }
      onSave(newMetadata)
    })
  }

  const addHorizontalDimension = () => {
    const newDimension: CrosstabAxisDimension = {
      id: uuidv4(),
      name: '新横轴维度',
      description: '',
      values: [],
      order: horizontalDimensions.length + 1
    }
    setHorizontalDimensions([...horizontalDimensions, newDimension])
  }

  const addVerticalDimension = () => {
    const newDimension: CrosstabAxisDimension = {
      id: uuidv4(),
      name: '新纵轴维度',
      description: '',
      values: [],
      order: verticalDimensions.length + 1
    }
    setVerticalDimensions([...verticalDimensions, newDimension])
  }

  const addValueDimension = () => {
    const newDimension: CrosstabValueDimension = {
      id: uuidv4(),
      name: '新值维度',
      description: ''
    }
    setValueDimensions([...valueDimensions, newDimension])
  }

  const updateHorizontalDimension = (index: number, field: keyof CrosstabAxisDimension, value: any) => {
    const newDimensions = [...horizontalDimensions]
    newDimensions[index] = { ...newDimensions[index], [field]: value }
    setHorizontalDimensions(newDimensions)
  }

  const updateVerticalDimension = (index: number, field: keyof CrosstabAxisDimension, value: any) => {
    const newDimensions = [...verticalDimensions]
    newDimensions[index] = { ...newDimensions[index], [field]: value }
    setVerticalDimensions(newDimensions)
  }

  const updateValueDimension = (index: number, field: keyof CrosstabValueDimension, value: any) => {
    const newDimensions = [...valueDimensions]
    newDimensions[index] = { ...newDimensions[index], [field]: value }
    setValueDimensions(newDimensions)
  }

  const deleteHorizontalDimension = (index: number) => {
    const newDimensions = horizontalDimensions.filter((_, i) => i !== index)
    setHorizontalDimensions(newDimensions)
  }

  const deleteVerticalDimension = (index: number) => {
    const newDimensions = verticalDimensions.filter((_, i) => i !== index)
    setVerticalDimensions(newDimensions)
  }

  const deleteValueDimension = (index: number) => {
    const newDimensions = valueDimensions.filter((_, i) => i !== index)
    setValueDimensions(newDimensions)
  }

  const renderDimensionCard = (
    dimension: CrosstabAxisDimension,
    index: number,
    updateFunction: (index: number, field: keyof CrosstabAxisDimension, value: any) => void,
    deleteFunction: (index: number) => void
  ) => (
    <Card
      key={dimension.id}
      size="small"
      title={`维度 ${index + 1}`}
      extra={
        <Popconfirm
          title="确定要删除这个维度吗？"
          onConfirm={() => deleteFunction(index)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <label>名称：</label>
          <Input
            value={dimension.name}
            onChange={(e) => updateFunction(index, 'name', e.target.value)}
            placeholder="维度名称"
          />
        </div>
        <div>
          <label>描述：</label>
          <TextArea
            value={dimension.description}
            onChange={(e) => updateFunction(index, 'description', e.target.value)}
            placeholder="维度描述"
            rows={2}
          />
        </div>
      </Space>
    </Card>
  )

  const renderValueDimensionCard = (
    dimension: CrosstabValueDimension,
    index: number
  ) => (
    <Card
      key={dimension.id}
      size="small"
      title={`值维度 ${index + 1}`}
      extra={
        <Popconfirm
          title="确定要删除这个值维度吗？"
          onConfirm={() => deleteValueDimension(index)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <label>名称：</label>
          <Input
            value={dimension.name}
            onChange={(e) => updateValueDimension(index, 'name', e.target.value)}
            placeholder="值维度名称"
          />
        </div>
        <div>
          <label>描述：</label>
          <TextArea
            value={dimension.description}
            onChange={(e) => updateValueDimension(index, 'description', e.target.value)}
            placeholder="值维度描述"
            rows={2}
          />
        </div>
      </Space>
    </Card>
  )

  return (
    <Modal
      title="编辑多维度交叉表元数据"
      open={isOpen}
      onOk={handleSave}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      width={800}
      style={{ top: 20 }}
    >
      <Form form={form} layout="vertical" preserve={false} initialValues={metadata || {}}>
        <Form.Item 
          label="主题" 
          name="topic" 
          rules={[{ required: true, message: '请输入主题' }]}
        >
          <Input placeholder="请输入主题" />
        </Form.Item>

        {/* 横轴维度 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4>横轴维度</h4>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addHorizontalDimension}
            >
              添加横轴维度
            </Button>
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {horizontalDimensions.map((dim, index) => 
              renderDimensionCard(dim, index, updateHorizontalDimension, deleteHorizontalDimension)
            )}
          </Space>
        </div>

        {/* 纵轴维度 */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4>纵轴维度</h4>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addVerticalDimension}
            >
              添加纵轴维度
            </Button>
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {verticalDimensions.map((dim, index) => 
              renderDimensionCard(dim, index, updateVerticalDimension, deleteVerticalDimension)
            )}
          </Space>
        </div>

        {/* 值维度 */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4>值维度</h4>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addValueDimension}
            >
              添加值维度
            </Button>
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {valueDimensions.map((dim, index) => 
              renderValueDimensionCard(dim, index)
            )}
          </Space>
        </div>
      </Form>
    </Modal>
  )
}

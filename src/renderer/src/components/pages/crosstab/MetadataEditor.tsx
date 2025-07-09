import React from 'react'
import { Modal, Form, Input } from 'antd'
import { CrosstabMetadata } from '../../../types'

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

  const handleSave = () => {
    form.validateFields().then((values) => {
      onSave(values)
    })
  }

  return (
    <Modal
      title="编辑主题元数据"
      open={isOpen}
      onOk={handleSave}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      width={600}
    >
      <Form form={form} layout="vertical" preserve={false} initialValues={metadata || {}}>
        <Form.Item label="Topic" name="Topic" rules={[{ required: true, message: '请输入主题' }]}>
          <Input placeholder="请输入主题" />
        </Form.Item>
        <Form.Item
          label="HorizontalAxis"
          name="HorizontalAxis"
          rules={[{ required: true, message: '请输入横轴' }]}
        >
          <Input placeholder="请输入横轴" />
        </Form.Item>
        <Form.Item
          label="VerticalAxis"
          name="VerticalAxis"
          rules={[{ required: true, message: '请输入纵轴' }]}
        >
          <Input placeholder="请输入纵轴" />
        </Form.Item>
        <Form.Item
          label="Value"
          name="Value"
          rules={[{ required: true, message: '请输入值的描述' }]}
        >
          <TextArea placeholder="请输入值的描述" autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

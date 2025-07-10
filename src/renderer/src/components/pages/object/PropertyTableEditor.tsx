import React, { useState, useEffect } from 'react'
import {
  Table,
  Input,
  Button,
  Space,
  Popconfirm,
  message,
  Tag,
  Select,
  InputNumber,
  Switch,
  DatePicker,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { TextArea } = Input

interface PropertyItem {
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array'
  isEditing?: boolean
  isNew?: boolean
}

interface PropertyTableEditorProps {
  properties: { [key: string]: any }
  onSave: (properties: { [key: string]: any }) => void
  disabled?: boolean
}

const PropertyTableEditor: React.FC<PropertyTableEditorProps> = ({
  properties,
  onSave,
  disabled = false
}) => {
  const [dataSource, setDataSource] = useState<PropertyItem[]>([])
  const [editingKey, setEditingKey] = useState<string>('')

  // 检测值的类型
  const detectType = (value: any): PropertyItem['type'] => {
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (
      value instanceof Date ||
      (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-'))
    )
      return 'date'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object' && value !== null) return 'json'
    return 'string'
  }

  // 初始化数据
  useEffect(() => {
    const items: PropertyItem[] = Object.entries(properties || {}).map(([key, value]) => ({
      key,
      value,
      type: detectType(value)
    }))
    setDataSource(items)
  }, [properties])

  // 添加新属性
  const handleAdd = () => {
    const newKey = `property`
    const newItem: PropertyItem = {
      key: newKey,
      value: '',
      type: 'string',
      isEditing: true,
      isNew: true
    }
    setDataSource([...dataSource, newItem])
    setEditingKey(newKey)
  }

  // 编辑属性
  const handleEdit = (key: string) => {
    setEditingKey(key)
    setDataSource(
      dataSource.map((item) => (item.key === key ? { ...item, isEditing: true } : item))
    )
  }

  // 保存属性
  const handleSave = (key: string) => {
    const item = dataSource.find((item) => item.key === key)
    if (!item) return

    // 验证键名
    if (!item.key.trim()) {
      message.error('属性名不能为空')
      return
    }

    // 检查键名是否重复
    const duplicateCount = dataSource.filter((d) => d.key === item.key).length
    if (duplicateCount > 1) {
      message.error('属性名不能重复')
      return
    }

    const newDataSource = dataSource.map((item) =>
      item.key === key ? { ...item, isEditing: false, isNew: false } : item
    )
    setDataSource(newDataSource)
    setEditingKey('')

    // 保存到父组件
    const newProperties = newDataSource.reduce(
      (acc, item) => {
        acc[item.key] = item.value
        return acc
      },
      {} as { [key: string]: any }
    )
    onSave(newProperties)
  }

  // 取消编辑
  const handleCancel = (key: string) => {
    const item = dataSource.find((item) => item.key === key)
    if (item?.isNew) {
      // 如果是新建的，直接删除
      setDataSource(dataSource.filter((item) => item.key !== key))
    } else {
      // 如果是编辑的，恢复原值
      const originalItem = Object.entries(properties || {}).find(([k]) => k === key)
      if (originalItem) {
        setDataSource(
          dataSource.map((item) =>
            item.key === key
              ? {
                  ...item,
                  key: originalItem[0],
                  value: originalItem[1],
                  isEditing: false
                }
              : item
          )
        )
      }
    }
    setEditingKey('')
  }

  // 删除属性
  const handleDelete = (key: string) => {
    const newDataSource = dataSource.filter((item) => item.key !== key)
    setDataSource(newDataSource)

    const newProperties = newDataSource.reduce(
      (acc, item) => {
        acc[item.key] = item.value
        return acc
      },
      {} as { [key: string]: any }
    )
    onSave(newProperties)
  }

  // 更新属性键
  const handleKeyChange = (oldKey: string, newKey: string) => {
    setDataSource(dataSource.map((item) => (item.key === oldKey ? { ...item, key: newKey } : item)))
  }

  // 更新属性值
  const handleValueChange = (key: string, value: any) => {
    setDataSource(dataSource.map((item) => (item.key === key ? { ...item, value } : item)))
  }

  // 更新属性类型
  const handleTypeChange = (key: string, type: PropertyItem['type']) => {
    let newValue: any = ''
    switch (type) {
      case 'number':
        newValue = 0
        break
      case 'boolean':
        newValue = false
        break
      case 'date':
        newValue = new Date().toISOString()
        break
      case 'json':
        newValue = {}
        break
      case 'array':
        newValue = []
        break
      default:
        newValue = ''
    }

    setDataSource(
      dataSource.map((item) => (item.key === key ? { ...item, type, value: newValue } : item))
    )
  }

  // 渲染值编辑器
  const renderValueEditor = (item: PropertyItem) => {
    const { key, value, type } = item

    switch (type) {
      case 'number':
        return (
          <InputNumber
            value={value}
            onChange={(val) => handleValueChange(key, val)}
            style={{ width: '100%' }}
          />
        )
      case 'boolean':
        return <Switch checked={value} onChange={(checked) => handleValueChange(key, checked)} />
      case 'date':
        return (
          <DatePicker
            value={value ? dayjs(value) : null}
            onChange={(date) => handleValueChange(key, date?.toISOString())}
            style={{ width: '100%' }}
          />
        )
      case 'json':
        return (
          <TextArea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleValueChange(key, parsed)
              } catch {
                handleValueChange(key, e.target.value)
              }
            }}
            rows={3}
            placeholder="请输入JSON格式数据"
          />
        )
      case 'array':
        return (
          <TextArea
            value={Array.isArray(value) ? JSON.stringify(value, null, 2) : value}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                if (Array.isArray(parsed)) {
                  handleValueChange(key, parsed)
                } else {
                  handleValueChange(key, e.target.value)
                }
              } catch {
                handleValueChange(key, e.target.value)
              }
            }}
            rows={3}
            placeholder="请输入数组格式数据，如: [1, 2, 3]"
          />
        )
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleValueChange(key, e.target.value)}
            placeholder="请输入属性值"
          />
        )
    }
  }

  // 渲染值显示
  const renderValueDisplay = (item: PropertyItem) => {
    const { value, type } = item

    switch (type) {
      case 'boolean':
        return <Tag color={value ? 'green' : 'red'}>{value ? '是' : '否'}</Tag>
      case 'date':
        return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'
      case 'json':
      case 'array':
        return (
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              maxWidth: '300px',
              overflow: 'auto',
              backgroundColor: '#f5f5f5',
              padding: '4px 8px',
              borderRadius: '4px'
            }}
          >
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </div>
        )
      default:
        return String(value || '')
    }
  }

  const columns: ColumnsType<PropertyItem> = [
    {
      title: '属性名',
      dataIndex: 'key',
      key: 'key',
      width: '25%',
      render: (text: string, record: PropertyItem) => {
        if (record.isEditing) {
          return (
            <Input
              value={text}
              onChange={(e) => handleKeyChange(record.key, e.target.value)}
              placeholder="请输入属性名"
            />
          )
        }
        return text
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (type: PropertyItem['type'], record: PropertyItem) => {
        if (record.isEditing) {
          return (
            <Select
              value={type}
              onChange={(value) => handleTypeChange(record.key, value)}
              style={{ width: '100%' }}
            >
              <Select.Option value="string">文本</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="boolean">布尔值</Select.Option>
              <Select.Option value="date">日期</Select.Option>
              <Select.Option value="json">JSON对象</Select.Option>
              <Select.Option value="array">数组</Select.Option>
            </Select>
          )
        }

        const typeColors = {
          string: 'blue',
          number: 'green',
          boolean: 'orange',
          date: 'purple',
          json: 'cyan',
          array: 'magenta'
        }

        const typeNames = {
          string: '文本',
          number: '数字',
          boolean: '布尔值',
          date: '日期',
          json: 'JSON',
          array: '数组'
        }

        return <Tag color={typeColors[type]}>{typeNames[type]}</Tag>
      }
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      width: '45%',
      render: (value: any, record: PropertyItem) => {
        if (record.isEditing) {
          return renderValueEditor(record)
        }
        return renderValueDisplay(record)
      }
    },
    {
      title: '操作',
      key: 'action',
      width: '15%',
      render: (_, record: PropertyItem) => {
        if (record.isEditing) {
          return (
            <Space>
              <Tooltip title="保存">
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={() => handleSave(record.key)}
                  disabled={disabled}
                />
              </Tooltip>
              <Tooltip title="取消">
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleCancel(record.key)}
                  disabled={disabled}
                />
              </Tooltip>
            </Space>
          )
        }

        return (
          <Space>
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record.key)}
                disabled={disabled || editingKey !== ''}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Popconfirm
                title="确定要删除这个属性吗？"
                onConfirm={() => handleDelete(record.key)}
                okText="确定"
                cancelText="取消"
                disabled={disabled}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  disabled={disabled || editingKey !== ''}
                />
              </Popconfirm>
            </Tooltip>
          </Space>
        )
      }
    }
  ]

  return (
    <div>
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>属性列表</span>
          <Tooltip title="支持多种数据类型：文本、数字、布尔值、日期、JSON对象、数组">
            <QuestionCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </div>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          disabled={disabled || editingKey !== ''}
        >
          添加属性
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="key"
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 600 }}
        locale={{ emptyText: '暂无属性' }}
      />
    </div>
  )
}

export default PropertyTableEditor

import React from 'react'
import { Button, Tag, Typography, Space, Tooltip } from 'antd'
import { 
  RightOutlined, 
  DeleteOutlined, 
  StarOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  FieldStringOutlined,
  NumberOutlined,
  CheckCircleOutlined,
  FunctionOutlined,
  CloseCircleOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { ObjectNode as ObjectNodeType } from '../../../types'

const { Text } = Typography

// 根据节点类型获取图标
const getNodeIcon = (type: ObjectNodeType['type']) => {
  switch (type) {
    case 'object':
      return <FileTextOutlined />
    case 'array':
      return <UnorderedListOutlined />
    case 'string':
      return <FieldStringOutlined />
    case 'number':
      return <NumberOutlined />
    case 'boolean':
      return <CheckCircleOutlined />
    case 'function':
      return <FunctionOutlined />
    case 'null':
      return <CloseCircleOutlined />
    default:
      return <SettingOutlined />
  }
}

// 根据节点类型获取标签颜色
const getTypeColor = (type: ObjectNodeType['type']) => {
  switch (type) {
    case 'object':
      return 'blue'
    case 'array':
      return 'cyan'
    case 'string':
      return 'green'
    case 'number':
      return 'orange'
    case 'boolean':
      return 'purple'
    case 'function':
      return 'volcano'
    case 'null':
      return 'default'
    default:
      return 'default'
  }
}

// 格式化值显示
const formatValue = (value: any, type: ObjectNodeType['type']): string => {
  if (value === null || value === undefined) {
    return 'null'
  }

  switch (type) {
    case 'string':
      return `"${value}"`
    case 'number':
      return String(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'array':
      return `[${Array.isArray(value) ? value.length : 0}]`
    case 'object':
      return `{${Object.keys(value || {}).length}}`
    case 'function':
      return 'f()'
    default:
      return String(value)
  }
}

interface ObjectNodeProps {
  node: ObjectNodeType
  level: number
  isSelected: boolean
  isExpanded: boolean
  hasChildren: boolean
  onSelect: () => void
  onToggleExpansion: () => void
  onDelete: () => void
  onGenerateChildren: (prompt: string) => void
}

const ObjectNode: React.FC<ObjectNodeProps> = ({
  node,
  level,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onToggleExpansion,
  onDelete,
  onGenerateChildren
}) => {
  // 处理AI生成
  const handleAIGenerate = () => {
    const prompt = window.prompt(`为 "${node.name}" 生成子对象。请描述您希望生成什么类型的子对象：`)
    if (prompt && prompt.trim()) {
      onGenerateChildren(prompt.trim())
    }
  }

  const isGenerating = node.metadata?.source === 'ai' && !hasChildren

  return (
    <div
      style={{
        paddingLeft: `${level * 16 + 12}px`,
        paddingRight: '12px',
        paddingTop: '4px',
        paddingBottom: '4px',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
        borderRadius: '0 4px 4px 0',
        marginRight: '8px',
        transition: 'all 0.2s ease',
        opacity: isGenerating ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = '#f5f5f5'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
    >
      {/* 展开/折叠按钮 */}
      <Button
        type="text"
        size="small"
        icon={hasChildren ? <RightOutlined rotate={isExpanded ? 90 : 0} /> : null}
        style={{
          width: 16,
          height: 16,
          minWidth: 16,
          padding: 0,
          border: 'none',
          fontSize: 10,
          transition: 'transform 0.2s ease',
          visibility: hasChildren ? 'visible' : 'hidden'
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (hasChildren) {
            onToggleExpansion()
          }
        }}
      />

      {/* 节点图标 */}
      <div style={{ fontSize: 14, color: '#1890ff', display: 'flex', alignItems: 'center' }}>
        {getNodeIcon(node.type)}
      </div>

      {/* 节点内容 */}
      <Space size={4} style={{ 
        flex: 1, 
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden'
      }}>
        <Text strong style={{ 
          fontSize: 13,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '150px'
        }}>
          {node.name}
        </Text>
        <Tag color={getTypeColor(node.type)} size="small" style={{ 
          fontSize: 10, 
          margin: 0,
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>
          {node.type}
        </Tag>
        
        {/* 显示值（对于非容器类型） */}
        {node.type !== 'object' && node.type !== 'array' && node.value !== undefined && (
          <Text 
            type="secondary" 
            style={{ 
              fontSize: 11, 
              fontFamily: 'monospace',
              marginLeft: 'auto',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {formatValue(node.value, node.type)}
          </Text>
        )}
      </Space>

      {/* 操作按钮 */}
      <Space size={2} style={{ opacity: 0, transition: 'opacity 0.2s ease' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0'
        }}
      >
        {/* AI生成按钮 */}
        <Tooltip title="AI生成子对象">
          <Button
            type="text"
            size="small"
            icon={<StarOutlined />}
            style={{ width: 20, height: 20, minWidth: 20, padding: 0 }}
            onClick={(e) => {
              e.stopPropagation()
              handleAIGenerate()
            }}
          />
        </Tooltip>

        {/* 删除按钮 */}
        {node.id !== node.parentId && (
          <Tooltip title="删除节点">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              style={{ width: 20, height: 20, minWidth: 20, padding: 0 }}
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            />
          </Tooltip>
        )}
      </Space>
    </div>
  )
}

export default ObjectNode 
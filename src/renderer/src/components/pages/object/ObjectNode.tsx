import React from 'react'
import { Button, Typography, Space, Tooltip, Input, App } from 'antd'
import {
  RightOutlined,
  DeleteOutlined,
  StarOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { ObjectNode as ObjectNodeType } from '../../../types'

const { Text } = Typography

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
  const { modal, message } = App.useApp()

  // 处理AI生成
  const handleAIGenerate = () => {
    let aiPrompt = ''
    
    modal.confirm({
      title: `为 "${node.name}" 生成子对象`,
      content: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">
              请描述您希望生成什么类型的子对象：
            </Typography.Text>
          </div>
          <Input.TextArea
            placeholder="例如：生成3个员工节点，包含姓名、部门、职位信息"
            rows={4}
            maxLength={200}
            showCount
            onChange={(e) => {
              aiPrompt = e.target.value
            }}
          />
        </div>
      ),
      okText: '生成',
      cancelText: '取消',
      width: 500,
      onOk: () => {
        if (aiPrompt.trim()) {
          onGenerateChildren(aiPrompt.trim())
          message.success('AI生成请求已提交')
        } else {
          message.warning('请输入生成提示')
          return Promise.reject()
        }
      }
    })
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
        <FileTextOutlined />
      </div>

      {/* 节点内容 */}
      <Space
        size={4}
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}
      >
        <Text
          strong
          style={{
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '200px'
          }}
        >
          {node.name}
        </Text>
      </Space>

      {/* 操作按钮 */}
      <Space
        size={2}
        style={{ opacity: 0, transition: 'opacity 0.2s ease' }}
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

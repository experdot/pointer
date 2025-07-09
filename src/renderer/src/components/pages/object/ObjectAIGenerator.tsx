import React, { useState, useRef } from 'react'
import { Button, Input, Typography, Space, Tag, Card, Divider, Tooltip, Empty } from 'antd'
import { 
  StarOutlined, 
  SendOutlined, 
  LoadingOutlined, 
  HistoryOutlined,
  BulbOutlined
} from '@ant-design/icons'
import { ObjectChat } from '../../../types'
import { useAppContext } from '../../../store/AppContext'

const { Title, Text } = Typography
const { TextArea } = Input

interface ObjectAIGeneratorProps {
  chatId: string
  selectedNodeId?: string | null
  onGenerate: (nodeId: string, prompt: string) => void
}

const ObjectAIGenerator: React.FC<ObjectAIGeneratorProps> = ({
  chatId,
  selectedNodeId,
  onGenerate
}) => {
  const { state } = useAppContext()
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 从状态中获取对象聊天数据
  const chat = state.pages.find(p => p.id === chatId) as ObjectChat | undefined
  
  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  const { nodes, generationHistory } = chat.objectData
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null

  // 预设提示模板
  const promptTemplates = [
    {
      name: '基础属性',
      prompt: '为这个对象生成一些基础属性，包括名称、类型、值等常见字段'
    },
    {
      name: '配置选项',
      prompt: '生成配置相关的属性，如设置、选项、参数等'
    },
    {
      name: '状态信息',
      prompt: '添加状态相关的属性，如状态码、标志位、计数器等'
    },
    {
      name: '时间戳',
      prompt: '生成时间相关的属性，如创建时间、更新时间、过期时间等'
    },
    {
      name: '元数据',
      prompt: '添加元数据属性，如版本、作者、描述、标签等'
    },
    {
      name: '关联对象',
      prompt: '生成关联的子对象或引用，如用户信息、产品详情等'
    }
  ]

  // 处理生成
  const handleGenerate = async () => {
    if (!selectedNode || !prompt.trim()) return

    setIsGenerating(true)
    try {
      await onGenerate(selectedNode.id, prompt.trim())
      setPrompt('')
    } catch (error) {
      console.error('生成失败:', error)
      alert('生成失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 使用模板
  const useTemplate = (template: string) => {
    setPrompt(template)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  // 使用历史记录
  const useHistoryPrompt = (historyPrompt: string) => {
    setPrompt(historyPrompt)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <div style={{ padding: '16px' }}>
      <Title level={5} style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <StarOutlined />
        AI 生成器
      </Title>

      {!selectedNode ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请选择一个节点来生成子对象"
          style={{ padding: '20px 0' }}
        />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 当前选中节点信息 */}
          <Card size="small" style={{ backgroundColor: '#f9f9f9' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              为 <Text strong>{selectedNode.name}</Text> ({selectedNode.type}) 生成子对象
            </Text>
          </Card>

          {/* 快速模板 */}
          <div>
            <Text type="secondary" style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>
              快速模板：
            </Text>
            <Space wrap>
              {promptTemplates.map((template, index) => (
                <Tag
                  key={index}
                  color="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() => useTemplate(template.prompt)}
                  title={template.prompt}
                >
                  {template.name}
                </Tag>
              ))}
            </Space>
          </div>

          {/* 提示输入框 */}
          <div>
            <TextArea
              ref={textareaRef}
              placeholder={`描述您希望生成的子对象...

例如：
- 生成用户信息相关的属性
- 添加配置选项和默认值
- 创建状态管理相关的字段

按 Ctrl+Enter 快速生成`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              rows={8}
              style={{ fontSize: '12px' }}
            />
          </div>

          {/* 操作按钮 */}
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {/* 历史记录按钮 */}
            {generationHistory.length > 0 && (
              <Tooltip title="查看生成历史">
                <Button
                  type="text"
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  历史
                </Button>
              </Tooltip>
            )}

            {/* 生成按钮 */}
            <Button
              type="primary"
              size="small"
              icon={isGenerating ? <LoadingOutlined spin /> : <SendOutlined />}
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              loading={isGenerating}
            >
              {isGenerating ? '生成中...' : '生成 (Ctrl+Enter)'}
            </Button>
          </Space>

          {/* 生成历史 */}
          {showHistory && generationHistory.length > 0 && (
            <Card 
              size="small" 
              title="生成历史" 
              style={{ maxHeight: '200px', overflow: 'auto' }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {generationHistory
                  .slice()
                  .reverse() // 最新的在前
                  .slice(0, 10) // 只显示最近10条
                  .map((record, index) => (
                    <div key={record.id}>
                      <Card
                        size="small"
                        style={{
                          cursor: 'pointer',
                          border: '1px solid #e8e8e8',
                          borderRadius: '4px'
                        }}
                        onClick={() => useHistoryPrompt(record.prompt)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#1890ff'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e8e8e8'
                        }}
                      >
                        <Text style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          {record.prompt.length > 50 
                            ? record.prompt.substring(0, 50) + '...' 
                            : record.prompt
                          }
                        </Text>
                        <Space split={<Divider type="vertical" />} style={{ fontSize: '10px' }}>
                          <Text type="secondary">{formatTime(record.timestamp)}</Text>
                          <Text type="secondary">生成了 {record.generatedNodeIds.length} 个节点</Text>
                        </Space>
                      </Card>
                      {index < 9 && <Divider style={{ margin: '4px 0' }} />}
                    </div>
                  ))
                }
              </Space>
            </Card>
          )}

          {/* 使用提示 */}
          <Card size="small" style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Space>
              <BulbOutlined style={{ color: '#52c41a' }} />
              <Text type="secondary" style={{ fontSize: '10px' }}>
                提示：描述得越具体，AI生成的结果越符合您的需求
              </Text>
            </Space>
          </Card>
        </Space>
      )}
    </div>
  )
}

export default ObjectAIGenerator 
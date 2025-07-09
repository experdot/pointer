import React, { useState, useRef, useCallback } from 'react'
import { Button, Input, Typography, Space, Tag, Card, Divider, Tooltip, Empty, Tabs, message } from 'antd'
import { 
  StarOutlined, 
  SendOutlined, 
  LoadingOutlined, 
  HistoryOutlined,
  BulbOutlined,
  FileTextOutlined,
  ToolOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { ObjectChat } from '../../../types'
import { useAppContext } from '../../../store/AppContext'
import { createObjectAIService } from './ObjectAIService'
import { createAIService } from '../../../services/aiService'
import { useSettings } from '../../../store/hooks/useSettings'

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
  const { state, dispatch } = useAppContext()
  const { settings } = useSettings()
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [activeTab, setActiveTab] = useState('children')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 从状态中获取对象聊天数据
  const chat = state.pages.find(p => p.id === chatId) as ObjectChat | undefined
  
  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  const { nodes, generationHistory } = chat.objectData
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null

  // 获取LLM配置
  const getLLMConfig = useCallback(() => {
    const { llmConfigs, defaultLLMId } = settings
    if (!llmConfigs || llmConfigs.length === 0) {
      return null
    }
    return llmConfigs.find(config => config.id === defaultLLMId) || llmConfigs[0]
  }, [settings])

  // 获取节点的完整上下文信息
  const getNodeContext = useCallback((nodeId: string) => {
    const node = nodes[nodeId]
    if (!node) return null

    // 获取祖先节点链
    const getAncestorChain = (currentNode: any): any[] => {
      const chain = [currentNode]
      let current = currentNode
      while (current.parentId && nodes[current.parentId]) {
        current = nodes[current.parentId]
        chain.unshift(current)
      }
      return chain
    }

    // 获取平级节点
    const getSiblings = (currentNode: any): any[] => {
      if (!currentNode.parentId) return []
      const parent = nodes[currentNode.parentId]
      if (!parent) return []
      
      return parent.children
        .map((childId: string) => nodes[childId])
        .filter((child: any) => child && child.id !== currentNode.id)
    }

    // 获取已有的子节点
    const getExistingChildren = (currentNode: any): any[] => {
      return currentNode.children
        .map((childId: string) => nodes[childId])
        .filter((child: any) => child)
    }

    const ancestorChain = getAncestorChain(node)
    const siblings = getSiblings(node)
    const existingChildren = getExistingChildren(node)

    return {
      node,
      ancestorChain,
      siblings,
      existingChildren
    }
  }, [nodes])

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

  // 处理生成子节点
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

  // 生成节点描述
  const handleGenerateDescription = async () => {
    if (!selectedNode || !prompt.trim()) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    setIsGenerating(true)
    try {
      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService)
      
      const description = await objectAIService.generateNodeDescription(selectedNode, prompt.trim())
      
      // 更新节点描述
      dispatch({
        type: 'UPDATE_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          nodeId: selectedNode.id,
          updates: { description }
        }
      })
      
      message.success('描述生成成功')
      setPrompt('')
    } catch (error) {
      console.error('生成描述失败:', error)
      message.error('生成描述失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 生成节点值
  const handleGenerateValue = async () => {
    if (!selectedNode || !prompt.trim()) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    setIsGenerating(true)
    try {
      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService)
      
      const value = await objectAIService.generateNodeValue(selectedNode, prompt.trim())
      
      // 更新节点值
      dispatch({
        type: 'UPDATE_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          nodeId: selectedNode.id,
          updates: { value }
        }
      })
      
      message.success('值生成成功')
      setPrompt('')
    } catch (error) {
      console.error('生成值失败:', error)
      message.error('生成值失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 生成对象属性
  const handleGenerateProperties = async () => {
    if (!selectedNode || !prompt.trim()) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    if (selectedNode.type !== 'object') {
      message.error('只能为object类型的节点生成属性')
      return
    }

    setIsGenerating(true)
    try {
      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService)
      
      const properties = await objectAIService.generateObjectProperties(selectedNode, prompt.trim())
      
      // 合并新属性到现有属性
      const updatedProperties = { ...selectedNode.properties, ...properties }
      
      // 更新节点属性
      dispatch({
        type: 'UPDATE_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          nodeId: selectedNode.id,
          updates: { properties: updatedProperties }
        }
      })
      
      message.success(`成功生成了 ${Object.keys(properties).length} 个属性`)
      setPrompt('')
    } catch (error) {
      console.error('生成属性失败:', error)
      message.error('生成属性失败，请稍后重试')
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



  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  // 获取当前功能的处理函数
  const getCurrentHandler = () => {
    switch (activeTab) {
      case 'children':
        return handleGenerate
      case 'description':
        return handleGenerateDescription
      case 'value':
        return handleGenerateValue
      case 'properties':
        return handleGenerateProperties
      default:
        return handleGenerate
    }
  }

  // 获取当前功能的提示文本
  const getCurrentPlaceholder = () => {
    switch (activeTab) {
      case 'children':
        return `描述您希望生成的子对象...

例如：
- 生成用户信息相关的属性
- 添加配置选项和默认值
- 创建状态管理相关的字段

按 Ctrl+Enter 快速生成`
      case 'description':
        return `描述您希望为节点生成的描述...

例如：
- 生成详细的功能说明
- 添加用途和特点描述
- 创建技术规格说明

按 Ctrl+Enter 快速生成`
      case 'value':
        return `描述您希望生成的值...

例如：
- 生成默认配置值
- 创建示例数据
- 设置合理的初始值

按 Ctrl+Enter 快速生成`
      case 'properties':
        return `描述您希望生成的对象属性...

例如：
- 生成配置相关属性
- 添加状态管理字段
- 创建元数据属性

按 Ctrl+Enter 快速生成`
      default:
        return ''
    }
  }

  // 获取当前功能的按钮文本
  const getCurrentButtonText = () => {
    if (isGenerating) return '生成中...'
    
    switch (activeTab) {
      case 'children':
        return '生成子对象'
      case 'description':
        return '生成描述'
      case 'value':
        return '生成值'
      case 'properties':
        return '生成属性'
      default:
        return '生成'
    }
  }

  // 检查当前功能是否可用
  const isCurrentFunctionAvailable = () => {
    if (!selectedNode) return false
    
    switch (activeTab) {
      case 'children':
        return true
      case 'description':
        return true
      case 'value':
        return true
      case 'properties':
        return selectedNode.type === 'object'
      default:
        return true
    }
  }

  // 获取功能不可用的提示
  const getUnavailableReason = () => {
    if (!selectedNode) return '请选择一个节点'
    
    switch (activeTab) {
      case 'properties':
        return selectedNode.type !== 'object' ? '只能为object类型的节点生成属性' : ''
      default:
        return ''
    }
  }

  // 修改键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      getCurrentHandler()()
    }
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
          description="请选择一个节点来使用AI生成功能"
          style={{ padding: '20px 0' }}
        />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 当前选中节点信息 */}
          <Card size="small" style={{ backgroundColor: '#f9f9f9' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              当前节点：<Text strong>{selectedNode.name}</Text> ({selectedNode.type})
            </Text>
          </Card>

          {/* 功能标签页 */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            items={[
              {
                key: 'children',
                label: (
                  <span>
                    <StarOutlined />
                    生成子对象
                  </span>
                ),
                children: (
                  <div>
                    {/* 快速模板 */}
                    <div style={{ marginBottom: '12px' }}>
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
                  </div>
                )
              },
              {
                key: 'description',
                label: (
                  <span>
                    <FileTextOutlined />
                    生成描述
                  </span>
                ),
                children: (
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                      当前描述：{selectedNode.description || '暂无描述'}
                    </Text>
                  </div>
                )
              },
              {
                key: 'value',
                label: (
                  <span>
                    <ToolOutlined />
                    生成值
                  </span>
                ),
                children: (
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                      当前值：{selectedNode.value !== null && selectedNode.value !== undefined ? JSON.stringify(selectedNode.value) : '暂无值'}
                    </Text>
                  </div>
                )
              },
              {
                key: 'properties',
                label: (
                  <span>
                    <SettingOutlined />
                    生成属性
                  </span>
                ),
                children: (
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                      当前属性：{Object.keys(selectedNode.properties || {}).length > 0 ? Object.keys(selectedNode.properties).join(', ') : '暂无属性'}
                    </Text>
                    {selectedNode.type !== 'object' && (
                      <Text type="warning" style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                        ⚠️ 只能为object类型的节点生成属性
                      </Text>
                    )}
                  </div>
                )
              }
            ]}
          />

          {/* 提示输入框 */}
          <div>
            <TextArea
              ref={textareaRef}
              placeholder={getCurrentPlaceholder()}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating || !isCurrentFunctionAvailable()}
              rows={6}
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
              onClick={getCurrentHandler()}
              disabled={isGenerating || !prompt.trim() || !isCurrentFunctionAvailable()}
              loading={isGenerating}
            >
              {getCurrentButtonText()} (Ctrl+Enter)
            </Button>
          </Space>

          {/* 功能不可用提示 */}
          {!isCurrentFunctionAvailable() && (
            <Card size="small" style={{ backgroundColor: '#fff2e8', border: '1px solid #ffbb96' }}>
              <Text type="warning" style={{ fontSize: '11px' }}>
                {getUnavailableReason()}
              </Text>
            </Card>
          )}

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
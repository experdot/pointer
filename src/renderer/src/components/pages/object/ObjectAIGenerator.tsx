import React, { useState, useRef } from 'react'
import {
  Button,
  Input,
  Space,
  Typography,
  Card,
  Empty,
  Tabs,
  Tag,
  message,
  Spin
} from 'antd'
import {
  StarOutlined,
  SendOutlined,
  HistoryOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { v4 as uuidv4 } from 'uuid'
import { ObjectChat, ObjectNode as ObjectNodeType } from '../../../types'
import { useAppContext } from '../../../store/AppContext'
import { useSettings } from '../../../store/hooks/useSettings'
import { createAIService } from '../../../services/aiService'
import { createObjectAIService } from './ObjectAIService'

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
  const [activeTab, setActiveTab] = useState('children')
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const textareaRef = useRef<any>(null)

  // 获取LLM配置
  const getLLMConfig = () => {
    const { llmConfigs, defaultLLMId } = settings
    if (!llmConfigs || llmConfigs.length === 0) {
      return null
    }
    return llmConfigs.find((config) => config.id === defaultLLMId) || llmConfigs[0]
  }

  // 从状态中获取对象聊天数据
  const chat = state.pages.find((p) => p.id === chatId) as ObjectChat | undefined

  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  const { nodes, selectedNodeId: currentSelectedNodeId } = chat.objectData
  const selectedNode =
    selectedNodeId || currentSelectedNodeId
      ? nodes[selectedNodeId || currentSelectedNodeId || '']
      : null

  // 获取当前功能类型的推荐记录
  const getCurrentRecommendations = (): string[] => {
    if (!selectedNode?.aiRecommendations) return []

    const recommendations =
      selectedNode.aiRecommendations[activeTab as keyof typeof selectedNode.aiRecommendations]
    return recommendations?.recommendations || []
  }

  // 获取当前功能类型的推荐时间戳
  const getCurrentRecommendationTimestamp = (): number | null => {
    if (!selectedNode?.aiRecommendations) return null

    const recommendations =
      selectedNode.aiRecommendations[activeTab as keyof typeof selectedNode.aiRecommendations]
    return recommendations?.timestamp || null
  }

  // 格式化推荐时间
  const formatRecommendationTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 30) return `${days}天前`
    return new Date(timestamp).toLocaleDateString('zh-CN')
  }

  // 获取生成历史
  const generationHistory = chat.objectData.generationHistory || []
  const recentPrompts = generationHistory
    .slice(-5)
    .map((record) => record.prompt)
    .filter((prompt, index, self) => self.indexOf(prompt) === index)

  // 获取AI推荐的提示词
  const getAIRecommendations = async () => {
    if (!selectedNode) {
      message.warning('请先选择一个节点')
      return
    }

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    setIsLoadingRecommendations(true)
    try {
      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService, dispatch, chat.id)

      const context = getGenerationContext(selectedNode)
      if (!context) {
        message.error('无法获取节点上下文')
        return
      }

      let recommendations: string[] = []

      switch (activeTab) {
        case 'children':
          recommendations = await objectAIService.getChildrenPromptRecommendations(context)
          break
        case 'description':
          recommendations = await objectAIService.getDescriptionPromptRecommendations(context)
          break
        case 'properties':
          recommendations = await objectAIService.getPropertiesPromptRecommendations(context)
          break
        case 'relations':
          recommendations = await objectAIService.getRelationsPromptRecommendations(context)
          break
        default:
          recommendations = []
      }

      // 保存推荐到节点
      const currentRecommendations = selectedNode.aiRecommendations || {}
      const updatedRecommendations = {
        ...currentRecommendations,
        [activeTab]: {
          recommendations,
          timestamp: Date.now(),
          modelId: llmConfig.id
        }
      }

      dispatch({
        type: 'UPDATE_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          nodeId: selectedNode.id,
          updates: { aiRecommendations: updatedRecommendations }
        }
      })

      message.success('AI推荐获取成功')
    } catch (error) {
      console.error('获取AI推荐失败:', error)
      message.error('获取AI推荐失败，请稍后重试')
    } finally {
      setIsLoadingRecommendations(false)
    }
  }

  // 获取当前功能的默认提示词
  const getDefaultPrompt = (): string => {
    switch (activeTab) {
      case 'children':
        return '生成子节点'
      case 'description':
        return '生成描述'
      case 'properties':
        return '生成属性'
      case 'relations':
        return '生成关系节点'
      default:
        return '生成'
    }
  }

  // 获取实际使用的提示词
  const getEffectivePrompt = (): string => {
    const trimmedPrompt = prompt.trim()
    return trimmedPrompt || getDefaultPrompt()
  }

  // 获取历史记录中的上下文数据
  const getGenerationContext = (currentNode: ObjectNodeType) => {
    if (!currentNode) return null

    // 获取节点完整信息（参考C#代码的GetInformation方法）
    const getNodeInformation = (node: ObjectNodeType): string => {
      let information = `# 节点 - [${node.name}]\n${node.description || ''}`

      // 添加属性信息
      if (node.properties && Object.keys(node.properties).length > 0) {
        const properties = Object.entries(node.properties).map(([key, value]) => ({
          Name: key,
          Value: value
        }))
        information += `\n## 属性列表\n${JSON.stringify(properties)}`
      }

      // 添加子节点信息
      if (node.children && node.children.length > 0) {
        const children = node.children
          .map((childId) => {
            const childNode = nodes[childId]
            return childNode
              ? childNode.description
                ? {
                    Name: childNode.name,
                    Description: childNode.description
                  }
                : {
                    Name: childNode.name
                  }
              : null
          })
          .filter(Boolean)

        if (children.length > 0) {
          information += `\n## 子节点列表\n${JSON.stringify(children)}`
        }
      }

      return information
    }

    // 从当前节点向上追踪到根节点，构建完整链路
    const buildAncestorChain = (node: ObjectNodeType): ObjectNodeType[] => {
      const chain: ObjectNodeType[] = []
      let current = node

      // 向上追踪到根节点
      while (current) {
        chain.unshift(current)
        if (current.parentId && nodes[current.parentId]) {
          current = nodes[current.parentId]
        } else {
          break
        }
      }

      return chain
    }

    // 获取同级节点
    const getSiblings = (node: ObjectNodeType): ObjectNodeType[] => {
      if (!node.parentId) return []
      const parent = nodes[node.parentId]
      if (!parent || !parent.children) return []
      return parent.children
        .filter((id) => id !== node.id)
        .map((id) => nodes[id])
        .filter(Boolean)
    }

    // 获取现有子节点
    const getExistingChildren = (node: ObjectNodeType): ObjectNodeType[] => {
      if (!node.children) return []
      return node.children.map((id) => nodes[id]).filter(Boolean)
    }

    const ancestorChain = buildAncestorChain(currentNode)
    const siblings = getSiblings(currentNode)
    const existingChildren = getExistingChildren(currentNode)

    // 构建完整的上下文信息
    const getFullContextInformation = (): string => {
      let contextInfo = '# 完整上下文信息\n\n'

      // 添加层级结构信息
      contextInfo += '## 节点层级结构\n'
      contextInfo += '从根节点到当前节点的完整路径：\n'
      ancestorChain.forEach((ancestor, index) => {
        const indent = '  '.repeat(index)
        contextInfo += `${indent}- ${ancestor.name}`
        if (ancestor.description) {
          contextInfo += ` (${ancestor.description})`
        }
        contextInfo += '\n'
      })

      // 添加每个层级节点的详细信息
      contextInfo += '\n## 路径节点详细信息\n'
      ancestorChain.forEach((ancestor, index) => {
        contextInfo += `\n### 第${index + 1}层节点\n`
        contextInfo += getNodeInformation(ancestor)
        contextInfo += '\n'
      })

      // 添加同级节点信息
      if (siblings.length > 0) {
        contextInfo += '\n## 同级节点信息\n'
        siblings.forEach((sibling) => {
          contextInfo += `\n### 同级节点 - ${sibling.name}\n`
          contextInfo += getNodeInformation(sibling)
          contextInfo += '\n'
        })
      } else {
        contextInfo += '\n## 同级节点信息\n无同级节点\n'
      }

      return contextInfo
    }

    return {
      node: currentNode,
      ancestorChain,
      siblings,
      existingChildren,
      // 新增：获取完整的上下文信息
      getFullContextInformation,
      // 新增：获取单个节点的完整信息
      getNodeInformation: (node: ObjectNodeType) => getNodeInformation(node)
    }
  }

  // 生成子节点
  const handleGenerate = async () => {
    if (!selectedNode) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    const effectivePrompt = getEffectivePrompt()
    setIsGenerating(true)
    try {
      const context = getGenerationContext(selectedNode)
      if (!context) {
        message.error('无法获取节点上下文')
        return
      }

      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService, dispatch, chat.id)

      const childrenNames = await objectAIService.generateChildrenNames(context, effectivePrompt)

      // 为每个子节点名称创建节点
      const newNodes = childrenNames.map((name) => ({
        id: uuidv4(),
        name,
        description: '',
        type: 'entity', // 默认类型为实体
        parentId: selectedNode.id,
        children: [],
        expanded: false,
        metadata: {
          createdAt: Date.now(),
          source: 'ai' as const,
          aiPrompt: effectivePrompt
        },
        properties: {}
      }))

      // 批量添加节点
      newNodes.forEach((node) => {
        dispatch({
          type: 'ADD_OBJECT_NODE',
          payload: {
            chatId: chat.id,
            node,
            parentId: selectedNode.id
          }
        })
      })

      // 展开当前节点以显示新生成的子节点
      dispatch({
        type: 'EXPAND_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          nodeId: selectedNode.id
        }
      })

      message.success(`成功生成了 ${newNodes.length} 个子节点`)
      setPrompt('')
    } catch (error) {
      console.error('生成子节点失败:', error)
      message.error('生成子节点失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 生成描述
  const handleGenerateDescription = async () => {
    if (!selectedNode) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    const effectivePrompt = getEffectivePrompt()
    setIsGenerating(true)
    try {
      const context = getGenerationContext(selectedNode)
      if (!context) {
        message.error('无法获取节点上下文')
        return
      }

      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService, dispatch, chat.id)

      const description = await objectAIService.generateNodeDescription(context, effectivePrompt)

      // 更新节点描述
      dispatch({
        type: 'UPDATE_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          nodeId: selectedNode.id,
          updates: { description }
        }
      })

      message.success('成功生成了节点描述')
      setPrompt('')
    } catch (error) {
      console.error('生成描述失败:', error)
      message.error('生成描述失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 生成属性
  const handleGenerateProperties = async () => {
    if (!selectedNode) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    const effectivePrompt = getEffectivePrompt()
    setIsGenerating(true)
    try {
      const context = getGenerationContext(selectedNode)
      if (!context) {
        message.error('无法获取节点上下文')
        return
      }

      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService, dispatch, chat.id)

      const properties = await objectAIService.generateObjectProperties(context, effectivePrompt)

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

  // 生成关系节点
  const handleGenerateRelations = async () => {
    if (!selectedNode) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    const effectivePrompt = getEffectivePrompt()
    setIsGenerating(true)
    try {
      const context = getGenerationContext(selectedNode)
      if (!context) {
        message.error('无法获取节点上下文')
        return
      }

      const aiService = createAIService(llmConfig)
      const objectAIService = createObjectAIService(llmConfig, aiService, dispatch, chat.id)

      // 获取可用的目标节点（排除当前节点和关系节点）
      const availableNodes = Object.values(nodes).filter(
        (node) => node.id !== selectedNode.id && node.type !== 'relation'
      )

      if (availableNodes.length === 0) {
        message.warning('没有可用的目标节点来创建关系')
        return
      }

      // 选择一个或多个目标节点来创建关系
      // 这里简化为选择所有可用节点，实际应用中可能需要用户选择
      let totalRelationNodes = 0
      let totalNodeUpdates = 0

      // 随机选择3个目标节点
      const randomNodes = [...availableNodes].sort(() => Math.random() - 0.5).slice(0, 3)

      for (const targetNode of randomNodes) {
        try {
          const result = await objectAIService.generateRelationNodes(
            context,
            selectedNode.id,
            targetNode.id,
            effectivePrompt,
            nodes
          )

          // 添加生成的关系节点到对象数据
          result.relationNodes.forEach((relationNode) => {
            dispatch({
              type: 'ADD_OBJECT_NODE',
              payload: {
                chatId: chat.id,
                node: relationNode
              }
            })
          })

          // 更新源节点和目标节点的连接
          result.nodeUpdates.forEach((update) => {
            dispatch({
              type: 'ADD_NODE_CONNECTION',
              payload: {
                chatId: chat.id,
                nodeId: update.nodeId,
                connection: update.connection
              }
            })
          })

          totalRelationNodes += result.relationNodes.length
          totalNodeUpdates += result.nodeUpdates.length
        } catch (error) {
          console.error(`生成与${targetNode.name}的关系失败:`, error)
        }
      }

      message.success(
        `成功生成了 ${totalRelationNodes} 个关系节点，更新了 ${totalNodeUpdates} 个节点连接`
      )
      setPrompt('')
    } catch (error) {
      console.error('生成关系节点失败:', error)
      message.error('生成关系节点失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 使用AI推荐的提示词
  const useRecommendation = (recommendation: string) => {
    setPrompt(recommendation)
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
      case 'properties':
        return handleGenerateProperties
      case 'relations':
        return handleGenerateRelations
      default:
        return handleGenerate
    }
  }

  // 获取当前功能的提示文本
  const getCurrentPlaceholder = () => {
    switch (activeTab) {
      case 'children':
        return `描述您希望生成的子对象...

提示：可以直接点击"生成子对象"按钮，使用默认提示词
按 Ctrl+Enter 快速生成`
      case 'description':
        return `描述您希望为节点生成的描述...

提示：可以直接点击"生成描述"按钮，使用默认提示词
按 Ctrl+Enter 快速生成`
      case 'properties':
        return `描述您希望生成的对象属性...

提示：可以直接点击"生成属性"按钮，使用默认提示词
按 Ctrl+Enter 快速生成`
      case 'relations':
        return `描述您希望生成的关系节点...

提示：可以直接点击"生成关系节点"按钮，使用默认提示词
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
      case 'properties':
        return '生成属性'
      case 'relations':
        return '生成关系节点'
      default:
        return '生成'
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
      <Title
        level={5}
        style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}
      >
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
          <Card size="small" style={{ background: '#f8f9fa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ fontSize: '14px' }}>
                当前节点：<Text strong>{selectedNode.name}</Text>
              </Text>
            </div>
          </Card>

          {/* 功能选项卡 */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'children',
                label: '生成子对象',
                children: null
              },
              {
                key: 'description',
                label: '生成描述',
                children: null
              },
              {
                key: 'properties',
                label: '生成属性',
                children: null
              },
              {
                key: 'relations',
                label: '生成关系节点',
                children: null
              }
            ]}
          />

          {/* 输入区域 */}
          <div>
            <TextArea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={getCurrentPlaceholder()}
              rows={4}
              maxLength={2000}
              onKeyDown={handleKeyDown}
              style={{ marginBottom: '12px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {prompt.length}/2000 字符
                {!prompt.trim() && (
                  <span style={{ marginLeft: '8px' }}>
                    （将使用默认提示词："{getDefaultPrompt()}"）
                  </span>
                )}
              </Text>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={getCurrentHandler()}
                loading={isGenerating}
              >
                {getCurrentButtonText()}
              </Button>
            </div>
          </div>

          {/* AI推荐区域 */}
          <Card
            size="small"
            title={
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>
                  <BulbOutlined style={{ marginRight: 4 }} />
                  AI 推荐提示词
                </span>
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={getAIRecommendations}
                  loading={isLoadingRecommendations}
                  style={{ fontSize: '12px' }}
                >
                  获取推荐
                </Button>
              </div>
            }
          >
            {isLoadingRecommendations ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: '8px' }}>
                  AI 正在分析并生成推荐...
                </Text>
              </div>
            ) : getCurrentRecommendations().length > 0 ? (
              <div>
                <Space wrap style={{ marginBottom: '12px' }}>
                  {getCurrentRecommendations().map((recommendation, index) => (
                    <Tag
                      key={index}
                      style={{ cursor: 'pointer', marginBottom: '4px' }}
                      onClick={() => useRecommendation(recommendation)}
                    >
                      {recommendation}
                    </Tag>
                  ))}
                </Space>
                {getCurrentRecommendationTimestamp() && (
                  <div style={{ textAlign: 'right', marginTop: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      <ClockCircleOutlined style={{ marginRight: '4px' }} />
                      {formatRecommendationTime(getCurrentRecommendationTimestamp()!)}
                    </Text>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  点击"获取推荐"按钮，让 AI 为您推荐合适的提示词
                </Text>
              </div>
            )}
          </Card>

          {/* 历史记录 */}
          {recentPrompts.length > 0 && (
            <Card
              size="small"
              title={
                <>
                  <HistoryOutlined style={{ marginRight: 4 }} />
                  最近使用
                </>
              }
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {recentPrompts.map((historyPrompt, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    onClick={() => useHistoryPrompt(historyPrompt)}
                  >
                    <Text ellipsis={{ tooltip: historyPrompt }}>{historyPrompt}</Text>
                  </div>
                ))}
              </Space>
            </Card>
          )}
        </Space>
      )}
    </div>
  )
}

export default ObjectAIGenerator

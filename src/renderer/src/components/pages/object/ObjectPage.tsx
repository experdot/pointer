import React, { useEffect, useCallback, useState } from 'react'
import { Layout, Space, Typography, App } from 'antd'
import { ProjectOutlined } from '@ant-design/icons'
import { ObjectChat } from '../../../types/type'
import { useAppContext } from '../../../store/AppContext'
import ObjectBrowser from './ObjectBrowser'
import ObjectPropertyView from './ObjectPropertyView'
import ObjectAIGenerator from './ObjectAIGenerator'
import ObjectCrosstabAnalyzer from './ObjectCrosstabAnalyzer'
import RelationshipGraph from './RelationshipGraph'
import PageLineageDisplay from '../../common/PageLineageDisplay'
import ModelSelector from '../chat/ModelSelector'
import { createAIService } from '../../../services/aiService'
import { useSettings } from '../../../store/hooks/useSettings'
import { v4 as uuidv4 } from 'uuid'
import { ObjectNode as ObjectNodeType } from '../../../types/type'
import { createObjectAIService } from './ObjectAIService'
import { createObjectRootWithMetaRelations } from '../../../store/helpers'

const { Sider, Content } = Layout
const { Title } = Typography

interface ObjectPageProps {
  chatId: string
}

const ObjectPage: React.FC<ObjectPageProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const { message } = App.useApp()
  const { settings } = useSettings()
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    state.settings.defaultLLMId
  )

  // 从状态中获取对象聊天数据
  const chat = state.pages.find((p) => p.id === chatId) as ObjectChat | undefined

  if (!chat || chat.type !== 'object') {
    return <div>对象页面数据加载错误</div>
  }

  // 获取LLM配置
  const getLLMConfig = useCallback(() => {
    const targetModelId = selectedModel || state.settings.defaultLLMId
    const { llmConfigs } = settings
    if (!llmConfigs || llmConfigs.length === 0) {
      return null
    }

    return llmConfigs.find((config) => config.id === targetModelId) || llmConfigs[0]
  }, [selectedModel, settings, state.settings.defaultLLMId])

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId)
  }, [])

  // 处理节点选择（用于图谱交互）
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      dispatch({
        type: 'SELECT_OBJECT_NODE',
        payload: { chatId: chat.id, nodeId }
      })
    },
    [dispatch, chat.id]
  )

  // 获取节点的完整上下文信息
  const getNodeContext = useCallback(
    (nodeId: string) => {
      const { nodes } = chat.objectData
      const node = nodes[nodeId]
      if (!node) return null

      // 获取祖先节点链
      const getAncestorChain = (currentNode: ObjectNodeType): ObjectNodeType[] => {
        const chain = [currentNode]
        let current = currentNode
        while (current.parentId && nodes[current.parentId]) {
          current = nodes[current.parentId]
          chain.unshift(current)
        }
        return chain
      }

      // 获取平级节点
      const getSiblings = (currentNode: ObjectNodeType): ObjectNodeType[] => {
        if (!currentNode.parentId) return []
        const parent = nodes[currentNode.parentId]
        if (!parent) return []

        return parent.children
          .map((childId) => nodes[childId])
          .filter((child) => child && child.id !== currentNode.id)
      }

      // 获取已有的子节点
      const getExistingChildren = (currentNode: ObjectNodeType): ObjectNodeType[] => {
        return currentNode.children.map((childId) => nodes[childId]).filter((child) => child)
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
    },
    [chat.objectData]
  )

  // 处理AI生成子节点（只生成名称）
  const handleGenerateChildren = useCallback(
    async (nodeId: string, prompt: string) => {
      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      const context = getNodeContext(nodeId)
      if (!context) {
        message.error('无法获取节点上下文')
        return
      }

      try {
        // 首先记录生成请求
        const generationId = uuidv4()
        dispatch({
          type: 'GENERATE_OBJECT_CHILDREN',
          payload: {
            chatId: chat.id,
            nodeId,
            prompt,
            modelId: llmConfig.id,
            generationId
          }
        })

        // 创建AI服务
        const aiService = createAIService(llmConfig)
        const objectAIService = createObjectAIService(llmConfig, aiService, dispatch, chat.id)

        // 调用AI服务生成子节点名称
        const names = await objectAIService.generateChildrenNames(context, prompt)

        // 创建节点对象（只有名称，其他属性为默认值）
        const newNodes: ObjectNodeType[] = []
        const newNodeIds: string[] = []

        names.forEach((name: string) => {
          const newNodeId = uuidv4()
          const newNode: ObjectNodeType = {
            id: newNodeId,
            name: name,
            type: 'entity', // 默认类型
            description: '', // 空描述，后续可以单独生成
            properties: {}, // 空属性，后续可以单独生成
            children: [],
            expanded: false,
            parentId: nodeId,
            metadata: {
              createdAt: Date.now(),
              source: 'ai' as const,
              aiPrompt: prompt
            }
          }

          newNodes.push(newNode)
          newNodeIds.push(newNodeId)
        })

        // 批量添加节点
        newNodes.forEach((node) => {
          dispatch({
            type: 'ADD_OBJECT_NODE',
            payload: { chatId: chat.id, node, parentId: nodeId }
          })
        })

        // 更新生成记录
        dispatch({
          type: 'UPDATE_GENERATION_RECORD',
          payload: {
            chatId: chat.id,
            generationId,
            generatedNodeIds: newNodeIds
          }
        })

        // 展开父节点以显示新生成的子节点
        dispatch({
          type: 'EXPAND_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId }
        })

        message.success(`成功生成了 ${newNodes.length} 个子节点`)
      } catch (error) {
        console.error('AI生成失败:', error)
        message.error('AI生成失败，请检查网络连接和配置')
      }
    },
    [dispatch, chat.id, chat.objectData, getLLMConfig, getNodeContext]
  )

  // 初始化对象数据（如果需要）
  useEffect(() => {
    const { objectData } = chat

    // 如果没有根节点，创建包含元关系的默认根节点
    if (!objectData.rootNodeId || !objectData.nodes[objectData.rootNodeId]) {
      const { rootNodeId, nodes, expandedNodes } = createObjectRootWithMetaRelations()

      dispatch({
        type: 'UPDATE_OBJECT_DATA',
        payload: {
          chatId: chat.id,
          data: {
            rootNodeId,
            nodes,
            selectedNodeId: undefined,
            expandedNodes,
            searchQuery: undefined,
            filteredNodeIds: undefined,
            generationHistory: objectData.generationHistory || []
          }
        }
      })
    }
  }, [chat, dispatch])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部：页面溯源信息 */}
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 16px'
        }}
      >
        <PageLineageDisplay pageId={chatId} size="small" showInCard={false} />
      </div>

      {/* 页面标题和模型选择器 */}
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '12px 16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            <ProjectOutlined /> 对象浏览器
          </Title>

          {/* 模型选择器 */}
          <Space>
            <span style={{ fontSize: '12px', color: '#666' }}>模型选择:</span>
            <ModelSelector
              llmConfigs={state.settings.llmConfigs || []}
              selectedModel={selectedModel}
              onChange={handleModelChange}
              size="small"
            />
          </Space>
        </div>
      </div>

      {/* 主体内容 */}
      <Layout style={{ flex: 1 }}>
        {/* 左侧：对象浏览器 */}
        <Sider
          width={350}
          theme="light"
          style={{
            minWidth: 300,
            maxWidth: 500,
            background: '#fafafa',
            borderRight: '1px solid #f0f0f0',
            resize: 'horizontal',
            overflow: 'auto'
          }}
        >
          <ObjectBrowser chatId={chatId} />
        </Sider>

        {/* 中间：属性视图 */}
        <Content style={{ background: '#fff', overflow: 'auto' }}>
          <ObjectPropertyView chatId={chatId} />
        </Content>

        {/* 右侧：工具面板 */}
        <Sider
          width={480}
          theme="light"
          style={{
            minWidth: 350,
            maxWidth: 600,
            background: '#fafafa',
            borderLeft: '1px solid #f0f0f0',
            resize: 'horizontal',
            overflow: 'auto'
          }}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* AI生成器 */}
            <div style={{ flex: '0 0 auto', overflow: 'auto' }}>
              <ObjectAIGenerator
                chatId={chatId}
                selectedNodeId={chat.objectData.selectedNodeId}
                onGenerate={handleGenerateChildren}
              />
            </div>

            {/* 交叉分析工具 */}
            <div style={{ flex: '0 0 auto' }}>
              <ObjectCrosstabAnalyzer chatId={chatId} />
            </div>

            {/* 关系图谱 */}
            <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '16px' }}>
              <RelationshipGraph
                allNodes={chat.objectData.nodes}
                selectedNodeId={chat.objectData.selectedNodeId}
                onNodeClick={handleNodeClick}
                width={400}
                height={300}
              />
            </div>
          </div>
        </Sider>
      </Layout>
    </div>
  )
}

export default ObjectPage

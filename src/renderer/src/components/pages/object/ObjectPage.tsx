import React, { useEffect, useCallback } from 'react'
import { Layout, message } from 'antd'
import { ObjectChat } from '../../../types'
import { useAppContext } from '../../../store/AppContext'
import ObjectBrowser from './ObjectBrowser'
import ObjectPropertyView from './ObjectPropertyView'
import ObjectAIGenerator from './ObjectAIGenerator'
import ObjectCrosstabAnalyzer from './ObjectCrosstabAnalyzer'
import { createAIService } from '../../../services/aiService'
import { useSettings } from '../../../store/hooks/useSettings'
import { v4 as uuidv4 } from 'uuid'
import { ObjectNode as ObjectNodeType } from '../../../types'

const { Sider, Content } = Layout

interface ObjectPageProps {
  chatId: string
}

const ObjectPage: React.FC<ObjectPageProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const { settings } = useSettings()
  
  // 从状态中获取对象聊天数据
  const chat = state.pages.find(p => p.id === chatId) as ObjectChat | undefined
  
  if (!chat || chat.type !== 'object') {
    return <div>对象页面数据加载错误</div>
  }

  // 生成唯一ID
  const generateId = () => {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 获取LLM配置
  const getLLMConfig = useCallback(() => {
    const { llmConfigs, defaultLLMId } = settings
    if (!llmConfigs || llmConfigs.length === 0) {
      return null
    }
    
    return llmConfigs.find(config => config.id === defaultLLMId) || llmConfigs[0]
  }, [settings])

  // 处理AI生成子节点
  const handleGenerateChildren = useCallback(async (nodeId: string, prompt: string) => {
    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    const { nodes } = chat.objectData

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

      // 构建AI提示词
      const parentNode = nodes[nodeId]
      const aiPrompt = `# 任务
根据用户的描述，为指定的对象节点生成子节点。你需要生成一个JSON数组，包含多个子节点的定义。

# 父节点信息
- 节点名称: ${parentNode.name}
- 节点类型: ${parentNode.type}
- 节点描述: ${parentNode.description || '无'}

# 用户需求
${prompt}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
[
  {
    "name": "子节点名称",
    "type": "object|array|string|number|boolean|null|function|custom",
    "description": "详细描述",
    "value": "如果是基础类型，提供具体值，否则可以为null",
    "properties": {} // 如果type是object且有具体属性，提供键值对
  }
]
\`\`\`

# 生成要求
1. 根据父节点的类型和上下文，生成合理的子节点
2. 每个子节点必须有name、type、description字段
3. 如果是基础类型（string、number、boolean），提供合理的value
4. 如果是object类型且有具体属性，在properties中提供
5. 生成的子节点数量建议在3-8个之间，确保质量优于数量

请开始生成：`

      // 调用AI服务
      const aiService = createAIService(llmConfig)
      const response = await new Promise<string>((resolve, reject) => {
        aiService.sendMessage(
          [{ id: 'temp', role: 'user', content: aiPrompt, timestamp: Date.now() }],
          {
            onChunk: () => {}, // 空的chunk处理函数
            onComplete: (response) => resolve(response),
            onError: (error) => reject(error)
          }
        )
      })

      // 解析AI响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response
      
      try {
        const generatedNodes = JSON.parse(jsonContent)
        if (!Array.isArray(generatedNodes)) {
          throw new Error('AI响应格式错误：期望数组格式')
        }

        // 创建节点对象
        const newNodes: ObjectNodeType[] = []
        const newNodeIds: string[] = []
        
        generatedNodes.forEach((nodeData: any) => {
          const newNodeId = uuidv4()
          const newNode: ObjectNodeType = {
            id: newNodeId,
            name: nodeData.name || '未命名节点',
            type: nodeData.type || 'custom',
            description: nodeData.description || '',
            value: nodeData.value,
            properties: nodeData.properties || {},
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
        newNodes.forEach(node => {
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
      } catch (parseError) {
        console.error('解析AI响应失败:', parseError)
        message.error('AI响应格式错误，请重试')
      }
    } catch (error) {
      console.error('AI生成失败:', error)
      message.error('AI生成失败，请检查网络连接和配置')
    }
  }, [dispatch, chat.id, chat.objectData, getLLMConfig])

  // 初始化对象数据（如果需要）
  useEffect(() => {
    const { objectData } = chat
    
    // 如果没有根节点，创建一个默认的根节点
    if (!objectData.rootNodeId || !objectData.nodes[objectData.rootNodeId]) {
      const rootId = generateId()
      const rootNode = {
        id: rootId,
        name: '根对象',
        type: 'object' as const,
        description: '对象的根节点',
        children: [],
        expanded: true,
        metadata: {
          createdAt: Date.now(),
          source: 'user' as const
        },
        properties: {}
      }

      dispatch({
        type: 'UPDATE_OBJECT_DATA',
        payload: {
          chatId: chat.id,
          data: {
            rootNodeId: rootId,
            nodes: { [rootId]: rootNode },
            selectedNodeId: undefined,
            expandedNodes: [rootId],
            searchQuery: undefined,
            filteredNodeIds: undefined,
            generationHistory: objectData.generationHistory || []
          }
        }
      })
    }
  }, [chat.id, chat.objectData, dispatch])

  return (
    <Layout style={{ height: '100%' }}>
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
        width={400} 
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
          <div style={{ flex: '1', overflow: 'auto' }}>
            <ObjectAIGenerator
              chatId={chatId}
              selectedNodeId={chat.objectData.selectedNodeId}
              onGenerate={handleGenerateChildren}
            />
          </div>
          
          {/* 交叉分析工具 */}
          <div style={{ flexShrink: 0 }}>
            <ObjectCrosstabAnalyzer chatId={chatId} />
          </div>
        </div>
      </Sider>
    </Layout>
  )
}

export default ObjectPage 
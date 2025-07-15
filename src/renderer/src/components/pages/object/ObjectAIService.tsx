import { ObjectNode as ObjectNodeType, AITask, ObjectNodeReference } from '../../../types'
import { v4 as uuidv4 } from 'uuid'

export interface AIGenerationContext {
  node: ObjectNodeType
  ancestorChain: ObjectNodeType[]
  siblings: ObjectNodeType[]
  existingChildren: ObjectNodeType[]
  getFullContextInformation?: () => string // 获取完整上下文信息
  getNodeInformation?: (node: ObjectNodeType) => string // 获取单个节点的完整信息
}

export interface AIGenerationResult {
  success: boolean
  data?: any
  error?: string
}

export class ObjectAIService {
  private llmConfig: any
  private aiService: any
  private dispatch: any
  private chatId?: string

  constructor(llmConfig: any, aiService: any, dispatch?: any, chatId?: string) {
    this.llmConfig = llmConfig
    this.aiService = aiService
    this.dispatch = dispatch
    this.chatId = chatId
  }

  // 生成子节点名称
  async generateChildrenNames(context: AIGenerationContext, userPrompt: string): Promise<string[]> {
    const { node: parentNode, existingChildren, getFullContextInformation } = context

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id, // 使用AI服务的requestId
        type: 'object_generation',
        status: 'running',
        title: '生成子节点名称',
        description: `为节点 "${parentNode.name}" 生成子节点名称`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: parentNode.id,
            prompt: userPrompt
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
根据用户的描述，为指定的对象节点生成子节点名称。你只需要生成一个JSON字符串数组，包含多个子节点的名称。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
- 节点名称: ${parentNode.name}
- 节点描述: ${parentNode.description || '无'}
- 现有属性: ${Object.keys(parentNode.properties || {}).length > 0 ? JSON.stringify(parentNode.properties, null, 2) : '无'}

# 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt}

# 输出格式
请严格按照以下JSON格式输出，只包含名称数组：
\`\`\`json
["子节点名称1", "子节点名称2", "子节点名称3", "..."]
\`\`\`

# 生成要求
1. 只生成子节点的名称，不包含其他信息
2. 避免与已有子节点重复
3. 参考同级节点的命名风格和上下文层级结构
4. 生成的名称应该语义清晰、简洁
5. 考虑父节点的类型、用途以及整个对象树的结构
6. 结合完整的上下文信息，确保生成的子节点符合整体架构
7. 若无特别说明，请生成尽可能多的子节点名称

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const names = JSON.parse(jsonContent)
      if (!Array.isArray(names)) {
        throw new Error('期望数组格式')
      }

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return names.filter((name) => typeof name === 'string' && name.trim())
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw new Error('AI响应格式错误')
    }
  }

  // 生成节点描述
  async generateNodeDescription(
    context: AIGenerationContext,
    userPrompt?: string
  ): Promise<string> {
    const { node, existingChildren, getFullContextInformation } = context

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id, // 使用AI服务的requestId
        type: 'object_generation',
        status: 'running',
        title: '生成节点描述',
        description: `为节点 "${node.name}" 生成描述`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: node.id,
            prompt: userPrompt || '生成描述'
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
为指定的对象节点生成一个准确、简洁的描述。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
- 节点名称: ${node.name}
- 节点描述: ${node.description || '无'}
- 现有属性: ${Object.keys(node.properties || {}).length > 0 ? JSON.stringify(node.properties, null, 2) : '无'}

# 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt || '请生成一个简洁明了的节点描述'}

# 输出要求
请直接输出节点描述，不要包含任何格式化标记或额外说明。描述应该：
1. 简洁明了，50-200字左右
2. 准确反映节点的用途和功能
3. 使用自然语言，避免过于技术性的表述
4. 符合整个对象系统的语境
5. 结合节点的属性、子节点等信息，提供全面的描述
6. 结合完整的上下文信息，确保描述符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return response.trim()
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw error
    }
  }

  // 生成对象属性
  async generateObjectProperties(
    context: AIGenerationContext,
    userPrompt?: string
  ): Promise<Record<string, any>> {
    const { node, existingChildren, getFullContextInformation } = context

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id, // 使用AI服务的requestId
        type: 'object_generation',
        status: 'running',
        title: '生成对象属性',
        description: `为节点 "${node.name}" 生成属性`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: node.id,
            prompt: userPrompt || '生成属性'
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
为指定的对象节点生成合适的属性。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
- 节点名称: ${node.name}
- 节点描述: ${node.description || '无'}
- 现有属性: ${Object.keys(node.properties || {}).length > 0 ? JSON.stringify(node.properties, null, 2) : '无'}

# 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt || '生成适合这个对象的属性'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
{
  "属性名1": "属性值1",
  "属性名2": "属性值2",
  "属性名3": "属性值3",
  "...": "..."
}
\`\`\`

# 生成要求
1. 生成的属性应该符合对象的名称和描述
2. 属性名应该简洁明了，使用驼峰命名法
3. 属性值应该是合适的数据类型
4. 避免与现有属性重复
5. 考虑节点的功能、用途以及在整个对象系统中的作用
6. 结合完整的上下文信息，确保生成的属性符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const properties = JSON.parse(jsonContent)

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return properties
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw error
    }
  }

  // 获取生成子节点的推荐提示词
  async getChildrenPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const {
      node: parentNode,
      ancestorChain,
      siblings,
      existingChildren,
      getFullContextInformation,
      getNodeInformation
    } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(parentNode)
        : `节点名称: ${parentNode.name}\n节点描述: ${parentNode.description || '无'}`

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
根据对象节点的上下文信息，为用户推荐5个用于生成子节点的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 已有子节点
${existingChildrenInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该具有启发性，能够指导用户生成相关的子节点
3. 考虑节点的类型、用途以及整个对象树的结构
4. 避免与已有子节点重复
5. 提示词应该涵盖不同的角度和维度
6. 结合完整的上下文信息，确保推荐的提示词符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取子节点推荐失败:', error)
      // 返回默认推荐
      return [
        '添加基本功能模块',
        '生成配置相关选项',
        '创建状态管理字段',
        '添加数据处理逻辑',
        '生成用户界面组件'
      ]
    }
  }

  // 获取生成描述的推荐提示词
  async getDescriptionPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(node)
        : `节点名称: ${node.name}\n节点描述: ${node.description || '无'}`

      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成节点描述的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户从不同角度描述节点
3. 考虑节点的功能、用途、特点以及在整个对象树中的位置
4. 提示词应该具有启发性和实用性
5. 涵盖功能说明、使用场景、技术特点等不同方面
6. 结合完整的上下文信息，确保推荐的提示词符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取描述推荐失败:', error)
      // 返回默认推荐
      return [
        '生成详细的功能说明',
        '描述主要用途和价值',
        '说明技术特点和优势',
        '介绍使用场景和应用',
        '解释核心概念和原理'
      ]
    }
  }

  // 获取生成属性的推荐提示词
  async getPropertiesPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(node)
        : `节点名称: ${node.name}\n节点描述: ${node.description || '无'}`

      const existingProperties = Object.keys(node.properties || {})
      const existingPropertiesInfo =
        existingProperties.length > 0
          ? existingProperties.map((key) => `  - ${key}: ${node.properties?.[key]}`).join('\n')
          : '  暂无属性'

      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成对象属性的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 已有属性
${existingPropertiesInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户生成有用的对象属性
3. 考虑配置信息等不同类型的属性
4. 避免与已有属性重复
5. 提示词应该具有实用性和针对性
6. 结合完整的上下文信息，确保推荐的属性符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取属性推荐失败:', error)
      // 返回默认推荐
      return [
        '添加基本配置参数',
        '生成状态管理属性',
        '创建元数据信息',
        '添加验证规则属性',
        '生成显示控制选项'
      ]
    }
  }

  // 生成对象引用关系
  async generateObjectReferences(
    context: AIGenerationContext,
    userPrompt?: string,
    allNodes?: { [nodeId: string]: ObjectNodeType }
  ): Promise<ObjectNodeReference[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    if (!allNodes) {
      throw new Error('需要提供所有节点信息来生成引用关系')
    }

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id,
        type: 'object_generation',
        status: 'running',
        title: '生成引用关系',
        description: `为节点 "${node.name}" 生成引用关系`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: node.id,
            prompt: userPrompt || '生成引用关系'
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(node)
        : `节点名称: ${node.name}\n节点描述: ${node.description || '无'}`

      // 构建所有可用节点的信息（排除当前节点）
      const availableNodes = Object.values(allNodes)
        .filter((n) => n.id !== node.id)
        .map((n) => ({
          id: n.id,
          name: n.name,
          description: n.description || '',
          path: this.getNodePath(n, allNodes)
        }))

      const availableNodesInfo = availableNodes
        .map(
          (n) => `  - [${n.id}] ${n.name} (${n.path})${n.description ? ` - ${n.description}` : ''}`
        )
        .join('\n')

      // 构建已有引用信息
      const existingReferences = node.references || []
      const existingReferencesInfo =
        existingReferences.length > 0
          ? existingReferences
              .map((ref) => `  - ${ref.name} (${ref.type}, ${ref.strength})`)
              .join('\n')
          : '  暂无引用'

      const aiPrompt = `# 任务
根据对象节点的信息和上下文，为指定节点生成引用关系。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 已有引用关系
${existingReferencesInfo}

# 可用节点列表
${availableNodesInfo}

# 用户需求
${userPrompt || '请分析当前节点可能需要引用的其他节点'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
[
  {
    "id": "节点ID",
    "name": "节点名称",
    "description": "引用关系描述",
    "type": "dependency|related|inspiration|conflict|custom",
    "strength": "weak|medium|strong"
  }
]
\`\`\`

# 生成要求
1. 分析当前节点的功能和属性，识别可能的依赖关系
2. 考虑节点在整个对象系统中的位置和作用
3. 引用类型说明：
   - dependency: 当前节点需要依赖的其他节点
   - related: 与当前节点相关但不是必需的节点
   - inspiration: 为当前节点提供灵感或参考的节点
   - conflict: 与当前节点存在冲突或对立关系的节点
   - custom: 自定义关系类型
4. 引用强度说明：
   - weak: 弱关系，可有可无
   - medium: 中等关系，有一定联系
   - strong: 强关系，紧密相关或必需
5. 避免与已有引用重复
6. 生成的引用关系应该合理且有意义
7. 如果没有找到合适的引用关系，可以返回空数组

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const references = JSON.parse(jsonContent)
      if (!Array.isArray(references)) {
        throw new Error('期望数组格式')
      }

      // 验证和处理引用
      const validReferences: ObjectNodeReference[] = []
      for (const ref of references) {
        if (ref.id && allNodes[ref.id] && ref.id !== node.id) {
          const targetNode = allNodes[ref.id]
          validReferences.push({
            id: ref.id,
            name: targetNode.name,
            description: ref.description || '',
            type: ref.type || 'related',
            strength: ref.strength || 'medium',
            metadata: {
              createdAt: Date.now(),
              source: 'ai',
              aiPrompt: userPrompt || '生成引用关系'
            }
          })
        }
      }

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return validReferences
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw error
    }
  }

  // 获取生成引用关系的推荐提示词
  async getReferencesPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(node)
        : `节点名称: ${node.name}\n节点描述: ${node.description || '无'}`

      const existingReferences = node.references || []
      const existingReferencesInfo =
        existingReferences.length > 0
          ? existingReferences
              .map((ref) => `  - ${ref.name} (${ref.type}, ${ref.strength})`)
              .join('\n')
          : '  暂无引用'

      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成引用关系的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 已有引用关系
${existingReferencesInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户识别和生成有用的引用关系
3. 考虑不同类型的引用关系（依赖、相关、冲突等）
4. 避免与已有引用重复
5. 提示词应该具有启发性和实用性
6. 结合完整的上下文信息，确保推荐的引用关系符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取引用推荐失败:', error)
      // 返回默认推荐
      return [
        '查找依赖的基础设施节点',
        '识别相关的配置和参数',
        '发现冲突的规则和限制',
        '寻找灵感来源和参考',
        '关联相关的功能模块'
      ]
    }
  }

  // 辅助方法：获取节点路径
  private getNodePath(
    node: ObjectNodeType,
    allNodes: { [nodeId: string]: ObjectNodeType }
  ): string {
    const path: string[] = []
    let current = node

    while (current && current.parentId) {
      const parent = allNodes[current.parentId]
      if (parent) {
        path.unshift(parent.name)
        current = parent
      } else {
        break
      }
    }

    return path.length > 0 ? path.join(' / ') : '根节点'
  }

  // 通用AI调用方法
  private async callAI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.aiService.sendMessage(
        [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
        {
          onChunk: () => {},
          onComplete: (response: string) => resolve(response),
          onError: (error: any) => reject(error)
        }
      )
    })
  }
}

// 工厂函数
export function createObjectAIService(
  llmConfig: any,
  aiService: any,
  dispatch?: any,
  chatId?: string
): ObjectAIService {
  return new ObjectAIService(llmConfig, aiService, dispatch, chatId)
}

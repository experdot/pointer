import { ObjectNode as ObjectNodeType, AITask } from '../../../types'
import { v4 as uuidv4 } from 'uuid'

export interface AIGenerationContext {
  node: ObjectNodeType
  ancestorChain: ObjectNodeType[]
  siblings: ObjectNodeType[]
  existingChildren: ObjectNodeType[]
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

  // 生成子节点名称（简化版）
  async generateChildrenNames(context: AIGenerationContext, userPrompt: string): Promise<string[]> {
    const { node: parentNode, ancestorChain, siblings, existingChildren } = context

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
      // 构建层级结构信息
      const hierarchyInfo = ancestorChain
        .map((ancestor, index) => {
          const indent = '  '.repeat(index)
          return `${indent}- ${ancestor.name}`
        })
        .join('\n')

      // 构建平级节点信息
      const siblingsInfo =
        siblings.length > 0
          ? siblings.map((sibling) => `  - ${sibling.name}`).join('\n')
          : '  无平级节点'

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren.map((child) => `  - ${child.name}`).join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
根据用户的描述，为指定的对象节点生成子节点名称。你只需要生成一个JSON字符串数组，包含多个子节点的名称。

# 对象结构上下文

## 层级结构（从根节点到当前节点）
${hierarchyInfo}

## 当前节点信息
- 节点名称: ${parentNode.name}
- 节点描述: ${parentNode.description || '无'}

## 平级节点信息
${siblingsInfo}

## 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt}

# 输出格式
请严格按照以下JSON格式输出，只包含名称数组：
\`\`\`json
["子节点名称1", "子节点名称2", "子节点名称3"]
\`\`\`

# 生成要求
1. 只生成子节点的名称，不包含其他信息
2. 避免与已有子节点重复
3. 参考平级节点的命名风格
4. 生成的名称应该语义清晰、简洁
5. 建议生成3-6个名称
6. 考虑父节点的类型和用途

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
  async generateNodeDescription(node: ObjectNodeType, userPrompt?: string): Promise<string> {
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
      const aiPrompt = `# 任务
为指定的对象节点生成一个准确、简洁的描述。

# 节点信息
- 名称: ${node.name}
- 当前描述: ${node.description || '无'}
- 属性数量: ${Object.keys(node.properties || {}).length}
- 子节点数量: ${node.children?.length || 0}

# 用户需求
${userPrompt || '请生成一个简洁明了的节点描述'}

# 输出要求
请直接输出节点描述，不要包含任何格式化标记或额外说明。描述应该：
1. 简洁明了，50-200字左右
2. 准确反映节点的用途和功能
3. 使用自然语言，避免过于技术性的表述
4. 符合整个对象系统的语境

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

  // 获取生成子节点的推荐提示词
  async getChildrenPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const { node: parentNode, ancestorChain, siblings, existingChildren } = context

    try {
      // 构建层级结构信息
      const hierarchyInfo = ancestorChain
        .map((ancestor, index) => {
          const indent = '  '.repeat(index)
          return `${indent}- ${ancestor.name}`
        })
        .join('\n')

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren.map((child) => `  - ${child.name}`).join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
根据对象节点的上下文信息，为用户推荐5个用于生成子节点的提示词。

# 对象结构上下文

## 层级结构（从根节点到当前节点）
${hierarchyInfo}

## 当前节点信息
- 节点名称: ${parentNode.name}
- 节点描述: ${parentNode.description || '无'}

## 已有子节点
${existingChildrenInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该具有启发性，能够指导用户生成相关的子节点
3. 考虑节点的类型和用途，提供有针对性的建议
4. 避免与已有子节点重复
5. 提示词应该涵盖不同的角度和维度

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
    const { node } = context

    try {
      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成节点描述的提示词。

# 节点信息
- 节点名称: ${node.name}
- 当前描述: ${node.description || '无'}
- 属性数量: ${Object.keys(node.properties || {}).length}
- 子节点数量: ${node.children?.length || 0}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户从不同角度描述节点
3. 考虑节点的功能、用途、特点等维度
4. 提示词应该具有启发性和实用性
5. 涵盖功能说明、使用场景、技术特点等不同方面

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
    const { node } = context

    try {
      const existingProperties = Object.keys(node.properties || {})
      const existingPropertiesInfo = existingProperties.length > 0
        ? existingProperties.map(key => `  - ${key}: ${node.properties?.[key]}`).join('\n')
        : '  暂无属性'

      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成对象属性的提示词。

# 节点信息
- 节点名称: ${node.name}
- 节点描述: ${node.description || '无'}
- 子节点数量: ${node.children?.length || 0}

## 已有属性
${existingPropertiesInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户生成有用的对象属性
3. 考虑配置项、状态信息、元数据等不同类型的属性
4. 避免与已有属性重复
5. 提示词应该具有实用性和针对性

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

  // 生成对象属性
  async generateObjectProperties(
    node: ObjectNodeType,
    userPrompt?: string
  ): Promise<Record<string, any>> {
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
      const aiPrompt = `# 任务
为指定的对象节点生成合适的属性。

# 节点信息
- 节点名称: ${node.name}
- 节点描述: ${node.description || '无'}
- 现有属性: ${Object.keys(node.properties || {}).length > 0 ? JSON.stringify(node.properties, null, 2) : '无'}

# 用户需求
${userPrompt || '生成适合这个对象的属性'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
{
  "属性名1": "属性值1",
  "属性名2": "属性值2",
  "属性名3": "属性值3"
}
\`\`\`

# 生成要求
1. 生成的属性应该符合对象的名称和描述
2. 属性名应该简洁明了，使用驼峰命名法
3. 属性值应该是合适的数据类型
4. 避免与现有属性重复
5. 建议生成3-8个属性

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

  // 优化节点结构
  async optimizeNodeStructure(
    node: ObjectNodeType,
    children: ObjectNodeType[],
    userPrompt?: string
  ): Promise<{
    suggestions: string[]
    optimizedChildren?: ObjectNodeType[]
  }> {
    const childrenInfo = children
      .map((child) => `- ${child.name}: ${child.description || '无描述'}`)
      .join('\n')

    const aiPrompt = `# 任务
分析当前节点结构并提供优化建议。

# 节点信息
- 名称: ${node.name}
- 描述: ${node.description || '无'}

# 子节点信息
${childrenInfo || '无子节点'}

# 用户需求
${userPrompt || '分析当前结构并提供优化建议'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
{
  "suggestions": [
    "建议1",
    "建议2",
    "建议3"
  ]
}
\`\`\`

# 分析要求
1. 检查命名是否规范
2. 检查结构是否合理
3. 检查是否有重复或冗余
4. 提供具体的改进建议

请开始分析：`

    const response = await this.callAI(aiPrompt)

    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonContent = jsonMatch ? jsonMatch[1] : response

    try {
      const result = JSON.parse(jsonContent)
      return {
        suggestions: result.suggestions || [],
        optimizedChildren: result.optimizedChildren
      }
    } catch (error) {
      throw new Error('AI响应格式错误')
    }
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
export function createObjectAIService(llmConfig: any, aiService: any, dispatch?: any, chatId?: string): ObjectAIService {
  return new ObjectAIService(llmConfig, aiService, dispatch, chatId)
}

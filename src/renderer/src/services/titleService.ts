import { ChatMessage, LLMConfig, ModelConfig } from '../types/type'
import { useSettingsStore } from '../stores/settingsStore'
import { createAIService } from './aiService'

// ==================== Prompt 模板 ====================

const TITLE_GENERATION_PROMPT = `请为以下消息生成一个简短的标题（不超过15个字），要求：
1. 准确概括消息的核心主题
2. 使用名词短语或动宾短语
3. 不要使用标点符号
4. 直接输出标题，不要有任何解释或前缀

消息内容：
{content}

标题：`

const TOPIC_GENERATION_PROMPT = `请为以下对话片段生成一个简短的话题名称（不超过15个字），要求：
1. 概括这段对话的主要讨论主题
2. 使用名词短语
3. 不要使用标点符号
4. 直接输出话题名称，不要有任何解释或前缀

对话内容：
{content}

话题名称：`

const TOPIC_SUGGESTION_PROMPT = `分析以下对话，判断当前消息是否开始了一个新的讨论主题。

上下文消息（最近几条）：
{context}

当前消息：
{currentMessage}

如果当前消息开始了一个新话题，请输出新话题的名称（不超过15个字）。
如果是继续之前的话题讨论，请输出"继续"。

请直接输出结果，不要有任何解释：`

const SESSION_TITLE_GENERATION_PROMPT = `请为以下对话生成一个简短的标题（不超过20个字），要求：
1. 准确概括整个对话的核心主题
2. 使用名词短语或动宾短语
3. 不要使用标点符号
4. 直接输出标题，不要有任何解释或前缀

对话内容：
{content}

标题：`

const TOPIC_SEGMENTATION_PROMPT = `分析以下对话，识别出话题的转折点。对话中的每条消息都有一个序号。

对话内容：
{conversation}

请识别出话题发生明显变化的消息序号，并为每个话题起一个简短的名称（不超过15个字）。

输出格式（JSON数组）：
[{"index": 消息序号, "topic": "话题名称"}, ...]

注意：
1. 第一条消息（序号0）通常是第一个话题的开始
2. 只标记话题真正发生变化的位置，不要过度分段
3. 一般3-10条消息可能构成一个话题
4. 直接输出JSON数组，不要有任何其他内容`

// ==================== 类型定义 ====================

export interface TitleGenerateOptions {
  content: string
  extraRequirements?: string
  llmId?: string
  modelConfigId?: string
  maxLength?: number
}

// ==================== 辅助函数 ====================

/**
 * 获取默认的 LLM 和 Model 配置
 */
function getDefaultConfigs(): { llmConfig: LLMConfig | null; modelConfig: ModelConfig | null } {
  const settings = useSettingsStore.getState().settings
  if (!settings) {
    return { llmConfig: null, modelConfig: null }
  }

  const llmConfig = settings.llmConfigs.items.find((c) => c.id === settings.defaultLLMId) || null
  const modelConfig =
    settings.modelConfigs.items.find((c) => c.id === settings.defaultModelConfigId) || null

  return { llmConfig, modelConfig }
}

/**
 * 获取指定的配置（或使用默认配置）
 */
function getConfigsWithOptions(
  llmId?: string,
  modelConfigId?: string
): { llmConfig: LLMConfig | null; modelConfig: ModelConfig | null } {
  const settings = useSettingsStore.getState().settings
  if (!settings) {
    return { llmConfig: null, modelConfig: null }
  }

  // 优先使用传入的 ID，否则使用默认 ID
  const targetLlmId = llmId || settings.defaultLLMId
  const targetModelConfigId = modelConfigId || settings.defaultModelConfigId

  const llmConfig = settings.llmConfigs.items.find((c) => c.id === targetLlmId) || null
  const modelConfig = settings.modelConfigs.items.find((c) => c.id === targetModelConfigId) || null

  return { llmConfig, modelConfig }
}

/**
 * 构建带额外要求的 Prompt
 */
function buildPromptWithRequirements(
  basePrompt: string,
  content: string,
  extraRequirements?: string
): string {
  let prompt = basePrompt.replace('{content}', truncateContent(content))
  if (extraRequirements?.trim()) {
    // 在标题/话题名称之前插入额外要求
    prompt = prompt.replace(/(标题|话题名称)：$/, `\n额外要求：${extraRequirements.trim()}\n\n$1：`)
  }
  return prompt
}

/**
 * 截断内容到指定长度
 */
function truncateContent(content: string, maxLength: number = 500): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '...'
}

/**
 * 使用 AI 生成文本（简化的非流式调用）
 */
async function generateWithAI(
  prompt: string,
  llmConfig: LLMConfig,
  modelConfig: ModelConfig | undefined
): Promise<string> {
  return new Promise((resolve, reject) => {
    const aiService = createAIService(llmConfig, modelConfig)

    let fullResponse = ''

    aiService.sendMessage(
      [{ id: 'system', role: 'user', content: prompt, createdAt: Date.now() }],
      {
        onChunk: (chunk) => {
          fullResponse += chunk
        },
        onComplete: () => {
          resolve(fullResponse.trim())
        },
        onError: (error) => {
          reject(error)
        }
      }
    )
  })
}

// ==================== 导出函数 ====================

export interface TitleGenerationResult {
  title: string
  success: boolean
  error?: string
}

/**
 * 为消息生成标题
 * @param content 消息内容
 * @param maxLength 标题最大长度
 */
export async function generateMessageTitle(
  content: string,
  maxLength: number = 15
): Promise<TitleGenerationResult> {
  const { llmConfig, modelConfig } = getDefaultConfigs()

  if (!llmConfig) {
    return { title: '', success: false, error: '未配置 LLM' }
  }

  try {
    const prompt = TITLE_GENERATION_PROMPT.replace('{content}', truncateContent(content))
    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 清理结果：移除可能的引号和多余空白
    let title = result
      .replace(/^["'""]|["'""]$/g, '')
      .replace(/^标题[：:]\s*/i, '')
      .trim()

    // 截断到最大长度
    if (title.length > maxLength) {
      title = title.slice(0, maxLength)
    }

    return { title, success: true }
  } catch (error) {
    console.error('Failed to generate title:', error)
    return { title: '', success: false, error: String(error) }
  }
}

/**
 * 为 Topic 生成名称
 * @param content 消息内容
 * @param maxLength Topic 最大长度
 */
export async function generateTopicTitle(
  content: string,
  maxLength: number = 15
): Promise<TitleGenerationResult> {
  const { llmConfig, modelConfig } = getDefaultConfigs()

  if (!llmConfig) {
    return { title: '', success: false, error: '未配置 LLM' }
  }

  try {
    const prompt = TOPIC_GENERATION_PROMPT.replace('{content}', truncateContent(content))
    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 清理结果：移除可能的引号和多余空白
    let title = result
      .replace(/^["'""]|["'""]$/g, '')
      .replace(/^(话题|主题)[：:]\s*/i, '')
      .trim()

    // 截断到最大长度
    if (title.length > maxLength) {
      title = title.slice(0, maxLength)
    }

    return { title, success: true }
  } catch (error) {
    console.error('Failed to generate topic title:', error)
    return { title: '', success: false, error: String(error) }
  }
}

export interface TopicSuggestionResult {
  shouldCreateTopic: boolean
  topicName?: string
  success: boolean
  error?: string
}

/**
 * 建议是否创建新 Topic
 * @param contextMessages 上下文消息（最近几条）
 * @param currentMessage 当前消息
 */
export async function suggestNewTopic(
  contextMessages: ChatMessage[],
  currentMessage: ChatMessage
): Promise<TopicSuggestionResult> {
  const { llmConfig, modelConfig } = getDefaultConfigs()

  if (!llmConfig) {
    return { shouldCreateTopic: false, success: false, error: '未配置 LLM' }
  }

  try {
    // 构建上下文
    const contextStr = contextMessages
      .slice(-5) // 最近5条
      .map((m) => `[${m.role}]: ${truncateContent(m.content, 200)}`)
      .join('\n')

    const prompt = TOPIC_SUGGESTION_PROMPT.replace('{context}', contextStr).replace(
      '{currentMessage}',
      `[${currentMessage.role}]: ${truncateContent(currentMessage.content, 300)}`
    )

    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 解析结果
    const cleanResult = result.trim()
    if (cleanResult === '继续' || cleanResult.toLowerCase() === 'continue') {
      return { shouldCreateTopic: false, success: true }
    }

    // 清理 topic 名称
    let topicName = cleanResult
      .replace(/^["'""]|["'""]$/g, '')
      .replace(/^(新话题|话题|主题)[：:]\s*/i, '')
      .trim()

    if (topicName.length > 15) {
      topicName = topicName.slice(0, 15)
    }

    return {
      shouldCreateTopic: true,
      topicName,
      success: true
    }
  } catch (error) {
    console.error('Failed to suggest topic:', error)
    return { shouldCreateTopic: false, success: false, error: String(error) }
  }
}

/**
 * 批量为消息生成标题（用于整理历史消息）
 * @param messages 需要生成标题的消息列表
 * @param onProgress 进度回调
 */
export async function batchGenerateTitles(
  messages: ChatMessage[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const total = messages.length

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    onProgress?.(i + 1, total)

    const result = await generateMessageTitle(message.content)
    if (result.success && result.title) {
      results.set(message.id, result.title)
    }

    // 添加小延迟避免请求过于频繁
    if (i < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return results
}

export interface TopicSegment {
  index: number
  topic: string
}

export interface TopicSegmentationResult {
  segments: TopicSegment[]
  success: boolean
  error?: string
}

/**
 * 智能分段 - 分析对话并识别话题转折点
 * @param messages 消息列表
 */
export async function analyzeTopicSegments(
  messages: ChatMessage[]
): Promise<TopicSegmentationResult> {
  const { llmConfig, modelConfig } = getDefaultConfigs()

  if (!llmConfig) {
    return { segments: [], success: false, error: '未配置 LLM' }
  }

  if (messages.length === 0) {
    return { segments: [], success: true }
  }

  try {
    // 构建对话内容（带序号）
    const conversationStr = messages
      .map((m, idx) => `[${idx}] ${m.role}: ${truncateContent(m.content, 150)}`)
      .join('\n\n')

    const prompt = TOPIC_SEGMENTATION_PROMPT.replace('{conversation}', conversationStr)
    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 解析 JSON 结果
    const cleanResult = result.trim()
    // 尝试提取 JSON 数组
    const jsonMatch = cleanResult.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Failed to parse topic segments: no JSON array found', cleanResult)
      return { segments: [], success: false, error: '无法解析分段结果' }
    }

    const segments: TopicSegment[] = JSON.parse(jsonMatch[0])

    // 验证并清理结果
    const validSegments = segments
      .filter(
        (s) =>
          typeof s.index === 'number' &&
          s.index >= 0 &&
          s.index < messages.length &&
          typeof s.topic === 'string' &&
          s.topic.trim().length > 0
      )
      .map((s) => ({
        index: s.index,
        topic: s.topic.trim().slice(0, 15)
      }))

    return { segments: validSegments, success: true }
  } catch (error) {
    console.error('Failed to analyze topic segments:', error)
    return { segments: [], success: false, error: String(error) }
  }
}

// ==================== 带选项的生成函数 ====================

/**
 * 为消息生成标题（带选项）
 * @param options 生成选项
 */
export async function generateMessageTitleWithOptions(
  options: TitleGenerateOptions
): Promise<TitleGenerationResult> {
  const { content, extraRequirements, llmId, modelConfigId, maxLength = 15 } = options
  const { llmConfig, modelConfig } = getConfigsWithOptions(llmId, modelConfigId)

  if (!llmConfig) {
    return { title: '', success: false, error: '未配置 LLM' }
  }

  try {
    const prompt = buildPromptWithRequirements(TITLE_GENERATION_PROMPT, content, extraRequirements)
    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 清理结果：移除可能的引号和多余空白
    let title = result
      .replace(/^["'""]|["'""]$/g, '')
      .replace(/^标题[：:]\s*/i, '')
      .trim()

    // 截断到最大长度
    if (title.length > maxLength) {
      title = title.slice(0, maxLength)
    }

    return { title, success: true }
  } catch (error) {
    console.error('Failed to generate title with options:', error)
    return { title: '', success: false, error: String(error) }
  }
}

/**
 * 为 Topic 生成名称（带选项）
 * @param options 生成选项
 */
export async function generateTopicTitleWithOptions(
  options: TitleGenerateOptions
): Promise<TitleGenerationResult> {
  const { content, extraRequirements, llmId, modelConfigId, maxLength = 15 } = options
  const { llmConfig, modelConfig } = getConfigsWithOptions(llmId, modelConfigId)

  if (!llmConfig) {
    return { title: '', success: false, error: '未配置 LLM' }
  }

  try {
    const prompt = buildPromptWithRequirements(TOPIC_GENERATION_PROMPT, content, extraRequirements)
    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 清理结果：移除可能的引号和多余空白
    let title = result
      .replace(/^["'""]|["'""]$/g, '')
      .replace(/^(话题|主题)[：:]\s*/i, '')
      .trim()

    // 截断到最大长度
    if (title.length > maxLength) {
      title = title.slice(0, maxLength)
    }

    return { title, success: true }
  } catch (error) {
    console.error('Failed to generate topic title with options:', error)
    return { title: '', success: false, error: String(error) }
  }
}

/**
 * 批量为消息生成标题（带选项）
 * @param messages 需要生成标题的消息列表
 * @param options 生成选项（不含 content）
 * @param onProgress 进度回调
 */
export async function batchGenerateTitlesWithOptions(
  messages: ChatMessage[],
  options: Omit<TitleGenerateOptions, 'content'>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const total = messages.length

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    onProgress?.(i + 1, total)

    const result = await generateMessageTitleWithOptions({
      content: message.content,
      ...options
    })
    if (result.success && result.title) {
      results.set(message.id, result.title)
    }

    // 添加小延迟避免请求过于频繁
    if (i < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return results
}

/**
 * 智能分段 - 分析对话并识别话题转折点（带选项）
 * @param messages 消息列表
 * @param options 生成选项（不含 content）
 */
export async function analyzeTopicSegmentsWithOptions(
  messages: ChatMessage[],
  options: Omit<TitleGenerateOptions, 'content'>
): Promise<TopicSegmentationResult> {
  const { extraRequirements, llmId, modelConfigId } = options
  const { llmConfig, modelConfig } = getConfigsWithOptions(llmId, modelConfigId)

  if (!llmConfig) {
    return { segments: [], success: false, error: '未配置 LLM' }
  }

  if (messages.length === 0) {
    return { segments: [], success: true }
  }

  try {
    // 构建对话内容（带序号）
    const conversationStr = messages
      .map((m, idx) => `[${idx}] ${m.role}: ${truncateContent(m.content, 150)}`)
      .join('\n\n')

    let prompt = TOPIC_SEGMENTATION_PROMPT.replace('{conversation}', conversationStr)

    // 添加额外要求
    if (extraRequirements?.trim()) {
      prompt = prompt.replace(
        '4. 直接输出JSON数组，不要有任何其他内容',
        `4. 直接输出JSON数组，不要有任何其他内容\n5. 额外要求：${extraRequirements.trim()}`
      )
    }

    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 解析 JSON 结果
    const cleanResult = result.trim()
    // 尝试提取 JSON 数组
    const jsonMatch = cleanResult.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Failed to parse topic segments: no JSON array found', cleanResult)
      return { segments: [], success: false, error: '无法解析分段结果' }
    }

    const segments: TopicSegment[] = JSON.parse(jsonMatch[0])

    // 验证并清理结果
    const validSegments = segments
      .filter(
        (s) =>
          typeof s.index === 'number' &&
          s.index >= 0 &&
          s.index < messages.length &&
          typeof s.topic === 'string' &&
          s.topic.trim().length > 0
      )
      .map((s) => ({
        index: s.index,
        topic: s.topic.trim().slice(0, 15)
      }))

    return { segments: validSegments, success: true }
  } catch (error) {
    console.error('Failed to analyze topic segments with options:', error)
    return { segments: [], success: false, error: String(error) }
  }
}

// ==================== Session Title 生成函数 ====================

/**
 * 为对话生成标题
 * @param messages 对话消息列表
 * @param maxLength 标题最大长度
 */
export async function generateSessionTitle(
  messages: ChatMessage[],
  maxLength: number = 20
): Promise<TitleGenerationResult> {
  const { llmConfig, modelConfig } = getDefaultConfigs()

  if (!llmConfig) {
    return { title: '', success: false, error: '未配置 LLM' }
  }

  if (messages.length === 0) {
    return { title: '', success: false, error: '对话为空' }
  }

  try {
    // 构建对话内容摘要（取前几条消息）
    const conversationContent = messages
      .slice(0, 10) // 取前10条消息
      .map((m) => `[${m.role}]: ${truncateContent(m.content, 200)}`)
      .join('\n')

    const prompt = SESSION_TITLE_GENERATION_PROMPT.replace(
      '{content}',
      truncateContent(conversationContent, 1500)
    )
    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 清理结果
    let title = result
      .replace(/^["'""]|["'""]$/g, '')
      .replace(/^(标题|对话标题)[：:]\s*/i, '')
      .trim()

    if (title.length > maxLength) {
      title = title.slice(0, maxLength)
    }

    return { title, success: true }
  } catch (error) {
    console.error('Failed to generate session title:', error)
    return { title: '', success: false, error: String(error) }
  }
}

/**
 * 为对话生成标题（带选项）
 * @param messages 对话消息列表
 * @param options 生成选项（不含 content）
 */
export async function generateSessionTitleWithOptions(
  messages: ChatMessage[],
  options: Omit<TitleGenerateOptions, 'content'>
): Promise<TitleGenerationResult> {
  const { extraRequirements, llmId, modelConfigId, maxLength = 20 } = options
  const { llmConfig, modelConfig } = getConfigsWithOptions(llmId, modelConfigId)

  if (!llmConfig) {
    return { title: '', success: false, error: '未配置 LLM' }
  }

  if (messages.length === 0) {
    return { title: '', success: false, error: '对话为空' }
  }

  try {
    // 构建对话内容摘要
    const conversationContent = messages
      .slice(0, 10)
      .map((m) => `[${m.role}]: ${truncateContent(m.content, 200)}`)
      .join('\n')

    const prompt = buildPromptWithRequirements(
      SESSION_TITLE_GENERATION_PROMPT,
      conversationContent,
      extraRequirements
    )
    const result = await generateWithAI(prompt, llmConfig, modelConfig || undefined)

    // 清理结果
    let title = result
      .replace(/^["'""]|["'""]$/g, '')
      .replace(/^(标题|对话标题)[：:]\s*/i, '')
      .trim()

    if (title.length > maxLength) {
      title = title.slice(0, maxLength)
    }

    return { title, success: true }
  } catch (error) {
    console.error('Failed to generate session title with options:', error)
    return { title: '', success: false, error: String(error) }
  }
}

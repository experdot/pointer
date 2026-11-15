/**
 * 标题与话题生成提示词
 *
 * 放在领域层是因为它只是纯字符串：内核与展示层共用同一份定义。
 */

import type { SupportedLanguage } from './locale'

export const MESSAGE_TITLE_PROMPT = `请为以下消息生成一个简短的标题（不超过15个字），要求：
1. 准确概括消息的核心主题
2. 使用名词短语或动宾短语
3. 不要使用标点符号
4. 直接输出标题，不要有任何解释或前缀

消息内容：
{content}

标题：`

export const TOPIC_TITLE_PROMPT = `请为以下对话片段生成一个简短的话题名称（不超过15个字），要求：
1. 概括这段对话的主要讨论主题
2. 使用名词短语
3. 不要使用标点符号
4. 直接输出话题名称，不要有任何解释或前缀

对话内容：
{content}

话题名称：`

export const SESSION_TITLE_PROMPT = `请为以下对话生成一个简短的标题（不超过20个字），要求：
1. 准确概括整个对话的核心主题
2. 使用名词短语或动宾短语
3. 不要使用标点符号
4. 直接输出标题，不要有任何解释或前缀

对话内容：
{content}

标题：`

export const TOPIC_SEGMENTATION_PROMPT = `分析以下对话，识别出话题的转折点。对话中的每条消息都有一个序号。

对话内容：
{content}

请识别出话题发生明显变化的消息序号，并为每个话题起一个简短的名称（不超过15个字）。

输出格式（JSON数组）：
[{"index": 消息序号, "topic": "话题名称"}, ...]

注意：
1. 第一条消息（序号0）通常是第一个话题的开始
2. 只标记话题真正发生变化的位置，不要过度分段
3. 一般3-10条消息可能构成一个话题
4. 直接输出JSON数组，不要有任何其他内容`

const MAX_PROMPT_CONTENT_LENGTH = 500

export function truncateForPrompt(content: string, maxLength = MAX_PROMPT_CONTENT_LENGTH): string {
  if (content.length <= maxLength) return content
  return `${content.slice(0, maxLength)}...`
}

export function buildPrompt(template: string, content: string, maxLength?: number): string {
  // 函数式替换：content 里的 $&、$'、$1 等不会被当作替换模式解释
  return template.replace('{content}', () => truncateForPrompt(content, maxLength))
}

/**
 * 把"额外要求"插入标题/话题提示词
 *
 * 与迁移前一致：插在输出锚点（"标题：" / "话题名称："）之前。
 */
export function applyExtraRequirements(
  prompt: string,
  extraRequirements?: string,
  language: SupportedLanguage = 'zh-CN'
): string {
  const extra = extraRequirements?.trim()
  if (!extra) return prompt
  const label = language === 'zh-CN' ? '额外要求：' : 'Additional requirements: '
  const boundary = prompt.lastIndexOf('\n\n')
  if (boundary < 0) return `${prompt}\n\n${label}${extra}`
  return `${prompt.slice(0, boundary)}\n${label}${extra}${prompt.slice(boundary)}`
}

/** 智能分段的额外要求：作为第 5 条注意项追加（与迁移前一致） */
export function applySegmentationRequirements(
  prompt: string,
  extraRequirements?: string,
  language: SupportedLanguage = 'zh-CN'
): string {
  const extra = extraRequirements?.trim()
  if (!extra) return prompt
  return `${prompt}\n5. ${language === 'zh-CN' ? '额外要求：' : 'Additional requirements: '}${extra}`
}

type TitlePromptKind = 'message' | 'topic' | 'session' | 'segmentation'

const ENGLISH_TITLE_PROMPTS: Record<TitlePromptKind, string> = {
  message:
    'Write a short title for the following message (at most 8 words and 60 characters). Summarize its central subject using a noun phrase or verb phrase. Do not use punctuation. Output only the title, without explanation.\n\nMessage:\n{content}\n\nTitle:',
  topic:
    'Write a short topic name for the following conversation excerpt (at most 8 words and 60 characters). Summarize the main subject using a noun phrase. Do not use punctuation. Output only the name.\n\nConversation:\n{content}\n\nTopic name:',
  session:
    'Write a short title for the following conversation (at most 10 words and 80 characters). Summarize its central subject using a noun phrase or verb phrase. Do not use punctuation. Output only the title.\n\nConversation:\n{content}\n\nTitle:',
  segmentation:
    'Identify topic changes in the following numbered conversation. Give each topic a short name (at most 8 words and 60 characters).\n\nConversation:\n{content}\n\nReturn a JSON array: [{"index": 0, "topic": "Topic name"}, ...]\n\nRules:\n1. Message 0 normally starts the first topic.\n2. Mark only meaningful topic changes.\n3. A topic typically covers 3–10 messages.\n4. Output only the JSON array.'
}

const CHINESE_TITLE_PROMPTS: Record<TitlePromptKind, string> = {
  message: MESSAGE_TITLE_PROMPT,
  topic: TOPIC_TITLE_PROMPT,
  session: SESSION_TITLE_PROMPT,
  segmentation: TOPIC_SEGMENTATION_PROMPT
}

/** 模板语言跟随界面，生成结果跟随对话内容；额外要求作为独立结构插入。 */
export function buildLocalizedTitlePrompt(
  kind: TitlePromptKind,
  language: SupportedLanguage,
  content: string,
  extraRequirements?: string,
  maxLength?: number
): string {
  const template = (language === 'zh-CN' ? CHINESE_TITLE_PROMPTS : ENGLISH_TITLE_PROMPTS)[kind]
  const languageRequirement =
    language === 'zh-CN'
      ? '生成的标题或话题名称使用对话内容的主要语言；无法判断时使用简体中文。'
      : 'Write titles and topic names in the predominant language of the conversation; use English only if its language cannot be determined.'
  const requirements = [languageRequirement, extraRequirements?.trim()].filter(Boolean).join('\n')
  const prompt = buildPrompt(template, content, maxLength)
  return kind === 'segmentation'
    ? applySegmentationRequirements(prompt, requirements, language)
    : applyExtraRequirements(prompt, requirements, language)
}

/** 清理模型返回的标题文本 */
export function normalizeTitle(raw: string, maxLength = 40): string {
  const firstLine = raw
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstLine) return ''

  return firstLine
    .replace(/^["'“”「『]+|["'“”」』]+$/g, '')
    .replace(/[。，,、；;：:！!？?]+$/g, '')
    .trim()
    .slice(0, maxLength)
}

interface TopicSegment {
  index: number
  topic: string
}

/** 解析话题分段结果，容错模型输出中的多余文本 */
export function parseTopicSegments(raw: string): TopicSegment[] {
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const parsed = JSON.parse(match[0]) as Array<{ index?: unknown; topic?: unknown }>
    return parsed
      .map((item) => ({
        index: Number(item.index),
        topic: typeof item.topic === 'string' ? item.topic.trim() : ''
      }))
      .filter((item) => Number.isFinite(item.index) && item.index >= 0 && item.topic.length > 0)
  } catch {
    return []
  }
}

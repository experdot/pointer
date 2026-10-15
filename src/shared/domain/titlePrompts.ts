/**
 * 标题与话题生成提示词
 *
 * 放在领域层是因为它只是纯字符串：内核与展示层共用同一份定义。
 */

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
export function applyExtraRequirements(prompt: string, extraRequirements?: string): string {
  const extra = extraRequirements?.trim()
  if (!extra) return prompt
  return prompt.replace(
    /(标题|话题名称)：$/,
    (_match, anchor: string) => `\n额外要求：${extra}\n\n${anchor}：`
  )
}

/** 智能分段的额外要求：作为第 5 条注意项追加（与迁移前一致） */
export function applySegmentationRequirements(prompt: string, extraRequirements?: string): string {
  const extra = extraRequirements?.trim()
  if (!extra) return prompt
  return prompt.replace(
    '4. 直接输出JSON数组，不要有任何其他内容',
    (match) => `${match}\n5. 额外要求：${extra}`
  )
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

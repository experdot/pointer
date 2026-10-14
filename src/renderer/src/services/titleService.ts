/**
 * 标题与话题生成服务
 *
 * 生成由内核完成（模型调用在主进程），这里只负责组织输入与后续写入。
 */

import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage } from '@shared/domain'
import {
  TOPIC_SEGMENTATION_PROMPT,
  applySegmentationRequirements,
  buildPrompt,
  parseTopicSegments,
  truncateForPrompt
} from '@shared/domain'
import { command } from '../runtime/client'
import * as messagesService from './messagesService'

export interface GenerateOptions {
  llmId?: string
  modelConfigId?: string
  extraRequirements?: string
}

export interface TitleGenerationResult {
  title: string
  success: boolean
  error?: string
}

async function generateTitleFor(
  pageId: string,
  target:
    | { kind: 'message'; messageId: string }
    | { kind: 'topic'; topicId: string }
    | { kind: 'session' },
  options: GenerateOptions
): Promise<TitleGenerationResult> {
  try {
    const title = await command('chat.generateTitle', {
      pageId,
      target,
      llmId: options.llmId,
      modelConfigId: options.modelConfigId,
      extraRequirements: options.extraRequirements
    })
    return { title, success: true }
  } catch (error) {
    return {
      title: '',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function generateMessageTitle(
  pageId: string,
  messageId: string,
  options: GenerateOptions = {}
): Promise<TitleGenerationResult> {
  return generateTitleFor(pageId, { kind: 'message', messageId }, options)
}

export const generateMessageTitleWithOptions = generateMessageTitle

export async function generateTopicTitle(
  pageId: string,
  topicId: string,
  options: GenerateOptions = {}
): Promise<TitleGenerationResult> {
  return generateTitleFor(pageId, { kind: 'topic', topicId }, options)
}

export const generateTopicTitleWithOptions = generateTopicTitle

export async function generateSessionTitle(
  pageId: string,
  options: GenerateOptions = {}
): Promise<TitleGenerationResult> {
  return generateTitleFor(pageId, { kind: 'session' }, options)
}

export const generateSessionTitleWithOptions = generateSessionTitle

export async function batchGenerateTitles(
  pageId: string,
  messageIds: readonly string[],
  options: GenerateOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  let success = 0

  for (let index = 0; index < messageIds.length; index++) {
    onProgress?.(index + 1, messageIds.length)
    const result = await generateTitleFor(
      pageId,
      { kind: 'message', messageId: messageIds[index] },
      options
    )
    if (result.success) {
      success += 1
    } else if (result.error) {
      errors.push(result.error)
    }
  }

  return { success, failed: messageIds.length - success, errors }
}

export const batchGenerateTitlesWithOptions = batchGenerateTitles

/**
 * 智能分段：让模型给出话题转折点，然后创建对应的 Topic
 */
export async function analyzeTopicSegments(
  pageId: string,
  currentPath: readonly ChatMessage[],
  options: GenerateOptions = {}
): Promise<{
  success: boolean
  created: number
  segments: Array<{ index: number; topic: string }>
  error?: string
}> {
  if (currentPath.length === 0) {
    return { success: false, created: 0, segments: [], error: '当前会话为空' }
  }

  const transcript = currentPath
    .map((message, index) => {
      const role = message.role === 'user' ? '用户' : '助手'
      return `${index}. ${role}：${truncateForPrompt(message.content, 150)}`
    })
    .join('\n\n')

  try {
    const { content } = await command('ai.generateText', {
      prompt: applySegmentationRequirements(
        buildPrompt(TOPIC_SEGMENTATION_PROMPT, transcript, 4000),
        options.extraRequirements
      ),
      llmId: options.llmId,
      modelConfigId: options.modelConfigId
    })

    const segments = parseTopicSegments(content)
    if (segments.length === 0) {
      return { success: false, created: 0, segments: [], error: '模型未返回可用分段' }
    }

    let created = 0
    for (const segment of segments) {
      const startMessage = currentPath[segment.index]
      if (!startMessage) continue
      await messagesService.createTopic(pageId, {
        id: uuidv4(),
        name: segment.topic,
        startMessageId: startMessage.id
      })
      created += 1
    }

    return { success: created > 0, created, segments }
  } catch (error) {
    return {
      success: false,
      created: 0,
      segments: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export const analyzeTopicSegmentsWithOptions = analyzeTopicSegments

export async function suggestNewTopic(): Promise<string> {
  return '继续'
}

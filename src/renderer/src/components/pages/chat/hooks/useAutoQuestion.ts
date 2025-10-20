import React, { useRef, useCallback, useEffect } from 'react'
import { usePagesStore } from '../../../../stores/pagesStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { ChatMessage } from '../../../../types/type'
import { createAIService } from '../../../../services/aiService'

export interface UseAutoQuestionProps {
  chatId: string
  autoQuestionEnabled: boolean
  autoQuestionMode: 'ai' | 'preset'
  autoQuestionListId?: string
  onSendMessageRef: React.MutableRefObject<
    ((content: string, customModelId?: string, customParentId?: string) => Promise<void>) | null
  >
  getLLMConfig: () => any
  getModelConfigForLLM: (id: string) => any
}

export interface UseAutoQuestionReturn {
  generateAndSendFollowUpQuestion: (lastAIMessageId: string) => Promise<void>
  resetPromptCounter: (listId: string) => void
  getPromptProgress: (listId: string) => { current: number; total: number; completed: boolean }
}

export function useAutoQuestion({
  chatId,
  autoQuestionEnabled,
  autoQuestionMode,
  autoQuestionListId,
  onSendMessageRef,
  getLLMConfig,
  getModelConfigForLLM
}: UseAutoQuestionProps): UseAutoQuestionReturn {
  const { settings } = useSettingsStore()

  // 使用ref存储最新的自动提问状态，避免闭包问题
  const autoQuestionRef = useRef({
    enabled: autoQuestionEnabled,
    mode: autoQuestionMode,
    listId: autoQuestionListId
  })

  // 为预设列表维护独立的计数器
  const promptCounterRef = useRef<Map<string, number>>(new Map())

  // 每次props变化时更新ref
  useEffect(() => {
    autoQuestionRef.current = {
      enabled: autoQuestionEnabled,
      mode: autoQuestionMode,
      listId: autoQuestionListId
    }
  }, [autoQuestionEnabled, autoQuestionMode, autoQuestionListId])

  // 重置特定预设列表的计数器
  const resetPromptCounter = useCallback((listId: string) => {
    promptCounterRef.current.set(listId, 0)
    console.log(`预设列表计数器已重置: ${listId}`)
  }, [])

  // 获取预设列表的当前进度
  const getPromptProgress = useCallback(
    (listId: string) => {
      const count = promptCounterRef.current.get(listId) || 0
      const list = settings.promptLists?.find((l) => l.id === listId)
      return {
        current: count,
        total: list?.prompts.length || 0,
        completed: list ? count >= list.prompts.length : false
      }
    },
    [settings.promptLists]
  )

  // 生成并发送追问的函数
  const generateAndSendFollowUpQuestion = useCallback(
    async (lastAIMessageId: string) => {
      // 再次检查自动提问开关是否还开启着
      const currentAutoQuestion = autoQuestionRef.current
      if (!currentAutoQuestion.enabled) {
        console.log('generateAndSendFollowUpQuestion - 自动提问已关闭，函数开始时跳过')
        return
      }

      const llmConfig = getLLMConfig()
      if (!llmConfig) return

      try {
        // 重新获取最新的页面状态
        const { pages } = usePagesStore.getState()
        const currentChat = pages.find((c) => c.id === chatId)
        if (!currentChat || !currentChat.messages) return

        // 获取当前对话历史
        const currentPath = currentChat.currentPath || []
        const currentMessages = currentPath
          .map((id) => currentChat.messages.find((msg) => msg.id === id))
          .filter(Boolean) as ChatMessage[]

        console.log(
          'generateAndSendFollowUpQuestion - currentMessages.length:',
          currentMessages.length
        )

        if (currentMessages.length < 2) {
          console.log('generateAndSendFollowUpQuestion - 对话历史不足，跳过自动追问')
          return
        }

        if (currentAutoQuestion.mode === 'preset') {
          await handlePresetMode(currentAutoQuestion)
        } else {
          await handleAIGeneratedMode(currentMessages, llmConfig)
        }
      } catch (error) {
        console.error('generateAndSendFollowUpQuestion error:', error)
        throw error
      }
    },
    [chatId, getLLMConfig, getModelConfigForLLM]
  )

  // 处理预设模式
  const handlePresetMode = useCallback(
    async (currentAutoQuestion: typeof autoQuestionRef.current) => {
      const listId = currentAutoQuestion.listId!
      const promptList = settings.promptLists?.find((list) => list.id === listId)
      if (!promptList || !promptList.prompts.length) {
        console.log('generateAndSendFollowUpQuestion - 未找到有效的提示词列表')
        return
      }

      // 获取当前预设列表的计数器
      const currentCount = promptCounterRef.current.get(listId) || 0

      // 检查是否已经问完所有提示词
      if (currentCount >= promptList.prompts.length) {
        console.log(`预设模式，列表 "${promptList.name}" 所有提示词已问完，停止自动提问`)
        promptCounterRef.current.set(listId, 0)
        return
      }

      const nextQuestion = `针对以上探讨的关键信息，请完成以下任务：
## 任务
${promptList.name}

## 任务描述
${promptList.description}

## 任务列表
${promptList.prompts.map((prompt, index) => `${index + 1}. ${prompt}`).join('\n')}

## 当前任务内容
请完成：${promptList.prompts[currentCount]}`

      console.log(
        `预设模式，列表 "${promptList.name}" 使用提示词 ${currentCount + 1}/${promptList.prompts.length}`
      )

      // 发送预设问题
      setTimeout(async () => {
        try {
          // 发送前再次检查最新状态
          const latestAutoQuestion = autoQuestionRef.current
          if (!latestAutoQuestion.enabled) {
            console.log('自动提问已关闭，跳过发送')
            return
          }

          const { pages: latestPages } = usePagesStore.getState()
          const latestChat = latestPages.find((c) => c.id === chatId)
          if (latestChat) {
            const latestCurrentPath = latestChat.currentPath || []
            const parentId =
              latestCurrentPath.length > 0
                ? latestCurrentPath[latestCurrentPath.length - 1]
                : undefined

            if (onSendMessageRef.current) {
              await onSendMessageRef.current(nextQuestion, undefined, parentId)
            }

            // 发送成功后，更新计数器
            const newCount = (promptCounterRef.current.get(listId) || 0) + 1
            promptCounterRef.current.set(listId, newCount)
            console.log(
              `预设模式，列表 "${promptList.name}" 计数器更新: ${newCount}/${promptList.prompts.length}`
            )
          }
        } catch (error) {
          console.error('Auto follow-up preset question failed:', error)
        }
      }, 500)
    },
    [settings.promptLists, chatId]
  )

  // 处理AI生成模式
  const handleAIGeneratedMode = useCallback(
    async (currentMessages: ChatMessage[], llmConfig: any) => {
      const followUpPrompt = `请基于以下对话历史，生成一个合理的用户追问问题。要求：
1. 问题应该自然地延续对话话题
2. 问题应该能够引发有价值的讨论
3. 问题应该简洁明了，不超过50字
4. 只返回问题本身，不要添加额外说明

对话历史：
${currentMessages
  .map((msg) => {
    const role = msg.role === 'user' ? '用户' : 'AI'
    return `${role}: ${msg.content}`
  })
  .join('\n\n')}

请生成一个合适的追问问题：`

      // 创建用于生成追问的消息数组
      const followUpMessage: ChatMessage = {
        id: 'follow-up-generation',
        role: 'user',
        content: followUpPrompt,
        timestamp: Date.now()
      }

      // 调用AI服务生成追问
      const modelConfig = getModelConfigForLLM(llmConfig.id)
      if (!modelConfig) {
        console.warn('未找到模型配置', llmConfig.id)
      }
      const aiService = createAIService(llmConfig, modelConfig)

      return new Promise((resolve, reject) => {
        let generatedQuestion = ''

        aiService.sendMessage([followUpMessage], {
          onChunk: (chunk: string) => {
            generatedQuestion += chunk
          },
          onComplete: async (fullResponse: string) => {
            const finalQuestion = (fullResponse || generatedQuestion).trim()

            if (finalQuestion && finalQuestion.length > 0) {
              setTimeout(async () => {
                try {
                  // 再次检查自动提问开关
                  const latestAutoQuestion = autoQuestionRef.current
                  if (!latestAutoQuestion.enabled) {
                    console.log('自动提问已关闭，跳过发送')
                    return
                  }

                  const { pages: latestPages } = usePagesStore.getState()
                  const latestChat = latestPages.find((c) => c.id === chatId)
                  if (latestChat) {
                    const latestCurrentPath = latestChat.currentPath || []
                    const parentId =
                      latestCurrentPath.length > 0
                        ? latestCurrentPath[latestCurrentPath.length - 1]
                        : undefined
                    if (onSendMessageRef.current) {
                      await onSendMessageRef.current(finalQuestion, undefined, parentId)
                    }
                  }
                } catch (error) {
                  console.error('Auto follow-up AI response failed:', error)
                }
              }, 500)
            }
            resolve(finalQuestion)
          },
          onError: (error: Error) => {
            console.error('Failed to generate follow-up question:', error)
            reject(error)
          }
        })
      })
    },
    [chatId, getModelConfigForLLM]
  )

  return {
    generateAndSendFollowUpQuestion,
    resetPromptCounter,
    getPromptProgress
  }
}

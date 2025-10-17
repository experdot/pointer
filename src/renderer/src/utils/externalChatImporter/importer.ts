import { v4 as uuidv4 } from 'uuid'
import { Page, ChatMessage, RegularChat } from '../../types/type'
import { MessageTree } from '../../components/pages/chat/messageTree'
import {
  SelectableChatItem,
  ParseResult,
  ImportResult,
  DeepSeekChat,
  OpenAIChat
} from './types'
import { detectChatFormat } from './formatDetector'
import { convertDeepSeekMessages, convertOpenAIMessages } from './converters'

/**
 * 解析外部聊天历史文件，返回可选择的聊天列表
 */
export function parseExternalChatHistory(jsonContent: string): ParseResult {
  try {
    const externalData = JSON.parse(jsonContent)
    const formatType = detectChatFormat(externalData)

    if (formatType === 'unknown') {
      return {
        success: false,
        formatType: 'unknown',
        pages: [],
        message: '不支持的文件格式。目前支持DeepSeek和OpenAI导出的聊天历史格式。'
      }
    }

    const pages: SelectableChatItem[] = []

    if (formatType === 'deepseek') {
      if (Array.isArray(externalData)) {
        externalData.forEach((chatData: DeepSeekChat, index) => {
          if (chatData.mapping && chatData.title) {
            // 计算消息数量
            const messageCount = Object.keys(chatData.mapping).filter(
              (key) => key !== 'root' && chatData.mapping[key]?.message
            ).length

            pages.push({
              id: `deepseek_${index}_${chatData.id}`,
              title: chatData.title,
              messageCount,
              createTime: new Date(chatData.inserted_at).getTime(),
              formatType: 'deepseek',
              originalData: chatData
            })
          }
        })
      }
    } else if (formatType === 'openai') {
      const chatArray = Array.isArray(externalData) ? externalData : [externalData]
      chatArray.forEach((chatData: OpenAIChat, index) => {
        if (chatData.mapping && chatData.title) {
          // 计算有效消息数量
          const messageCount = Object.values(chatData.mapping).filter(
            (node) =>
              node.message &&
              node.message.author.role !== 'system' &&
              node.message.content.parts.join('').trim() !== ''
          ).length

          pages.push({
            id: `openai_${index}_${chatData.conversation_id}`,
            title: chatData.title,
            messageCount,
            createTime: chatData.create_time * 1000,
            formatType: 'openai',
            originalData: chatData
          })
        }
      })
    }

    return {
      success: true,
      formatType,
      pages,
      message: `找到 ${pages.length} 个可导入的聊天记录`
    }
  } catch (error) {
    console.error('解析外部数据失败:', error)
    return {
      success: false,
      formatType: 'unknown',
      pages: [],
      message: '解析失败，请检查文件格式是否正确'
    }
  }
}

/**
 * 导入选中的聊天记录
 */
export function importSelectedChats(
  selectedItems: SelectableChatItem[],
  folderName?: string
): ImportResult {
  if (selectedItems.length === 0) {
    return {
      success: false,
      pages: [],
      successCount: 0,
      errorCount: 0,
      message: '未选择任何聊天记录'
    }
  }

  const pages: Page[] = []
  let successCount = 0
  let errorCount = 0

  const folderId = uuidv4()
  const finalFolderName = folderName || `外部导入-${new Date().toISOString().split('T')[0]}`

  selectedItems.forEach((item) => {
    try {
      let messages: ChatMessage[] = []

      if (item.formatType === 'deepseek') {
        const chatData = item.originalData as DeepSeekChat
        messages = convertDeepSeekMessages(chatData.mapping)
      } else if (item.formatType === 'openai') {
        const chatData = item.originalData as OpenAIChat
        messages = convertOpenAIMessages(chatData.mapping)
      }

      if (messages.length > 0) {
        // 使用MessageTree来生成正确的currentPath
        const messageTree = new MessageTree(messages)
        const currentPath = messageTree.getCurrentPath()

        const chat: RegularChat = {
          id: uuidv4(), // 生成新的ID避免冲突
          title: item.title,
          type: 'regular',
          messages,
          currentPath,
          folderId,
          createdAt: item.createTime,
          updatedAt: item.createTime
        }

        pages.push(chat)
        successCount++
      }
    } catch (error) {
      console.error('处理单个聊天时出错:', error)
      errorCount++
    }
  })

  if (pages.length > 0) {
    let message = `导入成功！共导入 ${successCount} 个聊天记录到文件夹"${finalFolderName}"`
    if (errorCount > 0) {
      message += `，失败 ${errorCount} 个`
    }

    return {
      success: true,
      pages,
      folder: { id: folderId, name: finalFolderName },
      successCount,
      errorCount,
      message
    }
  } else {
    return {
      success: false,
      pages: [],
      successCount: 0,
      errorCount: errorCount || 1,
      message: '未找到有效的聊天记录'
    }
  }
}


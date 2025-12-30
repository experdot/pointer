import { v4 as uuidv4 } from 'uuid'
import { RegularChat, PageLineage } from '../../types/type'

// 创建新的普通聊天
export const createNewChat = (
  title: string,
  folderId?: string,
  lineage?: PageLineage
): RegularChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  return {
    id: chatId,
    title,
    type: 'regular',
    messages: [],
    messageMap: {},
    currentPath: [],
    rootMessageId: undefined,
    folderId,
    createdAt: timestamp,
    updatedAt: timestamp,
    order: timestamp,
    lineage
  }
}

/**
 * 命令契约（写入）
 *
 * 命令中不出现文件路径、文件名或平台差异，一律由内核解析。
 */

import type {
  Account,
  AttachmentRef,
  ChatMessage,
  Conversation,
  Folder,
  MessageDraft,
  Page,
  Settings,
  Topic,
  WorkspacePathValidation,
  WorkspaceSummary,
  WorkspaceType
} from '../domain'
import type { ViewState } from './viewState'
import type { UpdateCheckResult } from './queries'

export type MessagePatch = Partial<
  Pick<
    ChatMessage,
    | 'content'
    | 'reasoning'
    | 'attachments'
    | 'title'
    | 'starred'
    | 'collapsed'
    | 'hasError'
    | 'llmId'
    | 'modelConfigId'
  >
>

export interface NodePatch {
  name?: string
  starred?: boolean
}

export interface ChatRequestHandle {
  requestId: string
  messageId: string
}

export type TitleTarget =
  | { kind: 'message'; messageId: string }
  | { kind: 'topic'; topicId: string }
  | { kind: 'session'; topicId?: string }

interface ImportFile {
  name: string
  mimeType: string
  dataBase64: string
}

export interface PickedImage extends ImportFile {
  size: number
}

export interface ImportSource {
  source: 'chatgpt' | 'deepseek' | 'pointer'
  payload: string
  folderName?: string
  /** 仅导入这些源对话 id；不传表示全部导入 */
  ids?: string[]
}

export interface ImportResult {
  importedPages: number
  importedMessages: number
}

interface FileFilter {
  name: string
  extensions: string[]
}

interface RuntimeCommandMap {
  // 会话与账户
  'session.selectAccount': { payload: { accountId: string }; result: void }
  'session.selectWorkspace': { payload: { workspaceId: string }; result: void }
  'account.create': { payload: { name: string; avatar?: string }; result: Account }
  'account.update': {
    payload: { accountId: string; patch: { name?: string; avatar?: string } }
    result: void
  }
  'account.delete': { payload: { accountId: string }; result: void }

  // 工作区
  'workspace.create': {
    payload: { name: string; type: WorkspaceType; path?: string }
    result: WorkspaceSummary
  }
  'workspace.validatePath': { payload: { dirPath: string }; result: WorkspacePathValidation }
  'workspace.repairPath': { payload: { dirPath: string }; result: WorkspacePathValidation }
  'workspace.rename': { payload: { workspaceId: string; name: string }; result: void }
  'workspace.delete': { payload: { workspaceId: string }; result: void }
  'workspace.openInFileManager': { payload: { workspaceId?: string }; result: void }
  'workspace.pickDirectory': { payload: { title?: string }; result: string | null }

  // 页面树
  'page.create': {
    payload: {
      name?: string
      parentFolderId?: string
      afterNodeId?: string
      starred?: boolean
    }
    result: Page
  }
  'page.update': { payload: { pageId: string; patch: NodePatch }; result: void }
  'page.move': {
    payload: { pageId: string; targetFolderId?: string; beforeNodeId?: string }
    result: void
  }
  'page.delete': { payload: { pageIds: string[] }; result: void }
  'folder.create': {
    payload: { name?: string; parentFolderId?: string; afterNodeId?: string }
    result: Folder
  }
  'folder.update': { payload: { folderId: string; patch: NodePatch }; result: void }
  'folder.move': {
    payload: { folderId: string; targetFolderId?: string; beforeNodeId?: string }
    result: void
  }
  'folder.delete': {
    payload: { folderIds: string[]; mode?: 'promote' | 'cascade' }
    result: void
  }
  'folder.clear': { payload: { folderId: string }; result: void }

  // 会话内容
  'conversation.append': {
    payload: { pageId: string; draft: MessageDraft }
    result: ChatMessage
  }
  /** 整体写入会话（备份恢复、批量导入） */
  'conversation.replace': {
    payload: { pageId: string; conversation: Conversation }
    result: void
  }
  'conversation.updateMessage': {
    payload: { pageId: string; messageId: string; patch: MessagePatch }
    result: void
  }
  /** 批量补丁（折叠/展开全部等），一次写入避免逐条重写会话文件 */
  'conversation.updateMessages': {
    payload: { pageId: string; messageIds: string[]; patch: MessagePatch }
    result: void
  }
  'conversation.deleteMessage': { payload: { pageId: string; messageId: string }; result: void }
  /** 切换分支：leaf 指向该分支链路最深的叶子，并记录选中消息 */
  'conversation.setLeaf': { payload: { pageId: string; messageId?: string }; result: void }
  'conversation.setSelected': { payload: { pageId: string; messageId?: string }; result: void }
  'topic.create': {
    payload: {
      pageId: string
      topic: { id: string; name: string; startMessageId: string; endMessageId?: string }
    }
    result: Topic
  }
  'topic.update': {
    payload: {
      pageId: string
      topicId: string
      patch: Partial<Pick<Topic, 'name' | 'endMessageId' | 'collapsed'>>
    }
    result: void
  }
  'topic.delete': { payload: { pageId: string; topicId: string }; result: void }

  // 对话执行
  'chat.send': {
    payload: {
      pageId: string
      content: string
      attachments?: AttachmentRef[]
      parentMessageId?: string
      llmId?: string
      modelConfigId?: string
    }
    result: ChatRequestHandle
  }
  'chat.regenerate': {
    payload: { pageId: string; messageId: string; llmId?: string; modelConfigId?: string }
    result: ChatRequestHandle
  }
  'chat.continue': {
    payload: { pageId: string; messageId?: string; llmId?: string; modelConfigId?: string }
    result: ChatRequestHandle
  }
  /** 中止生成：优先按 requestId，其次按页面中止该页面正在进行的请求 */
  'chat.stop': { payload: { requestId?: string; pageId?: string }; result: void }
  'chat.generateTitle': {
    payload: {
      pageId: string
      target: TitleTarget
      llmId?: string
      modelConfigId?: string
      extraRequirements?: string
    }
    result: string
  }
  'ai.generateText': {
    payload: { prompt: string; llmId?: string; modelConfigId?: string }
    result: { content: string; reasoning?: string }
  }

  // 消息队列
  'queue.add': { payload: { pageId: string; content: string }; result: string }
  'queue.update': { payload: { pageId: string; itemId: string; content: string }; result: void }
  'queue.remove': { payload: { pageId: string; itemId: string }; result: void }
  'queue.clear': { payload: { pageId: string }; result: void }
  'queue.setPaused': { payload: { pageId: string; paused: boolean }; result: void }

  // 设置与密钥
  'settings.replace': { payload: { settings: Settings }; result: void }

  // 展示层状态
  'viewState.replace': { payload: { viewState: ViewState }; result: void }

  // 附件与文件
  'attachment.import': {
    payload: { pageId: string; messageId?: string; files: ImportFile[] }
    result: AttachmentRef[]
  }
  'attachment.delete': { payload: { relativePath: string }; result: void }
  'dialog.saveFile': {
    payload: {
      suggestedName: string
      content: string
      filters?: FileFilter[]
      /** base64 表示二进制内容（图片等） */
      encoding?: 'utf8' | 'base64'
    }
    result: { savedPath?: string }
  }
  'dialog.openTextFile': {
    payload: { filters?: FileFilter[] }
    result: { name: string; content: string } | null
  }
  'dialog.pickImages': { payload: { multiple?: boolean }; result: PickedImage[] }
  'library.import': { payload: ImportSource; result: ImportResult }

  // 更新
  'app.checkUpdate': { payload: void; result: UpdateCheckResult }
  'app.downloadUpdate': { payload: void; result: void }
  'app.quitAndInstall': { payload: void; result: void }
}

export type RuntimeCommandName = keyof RuntimeCommandMap
export type RuntimeCommandPayload<K extends RuntimeCommandName> = RuntimeCommandMap[K]['payload']
export type RuntimeCommandResult<K extends RuntimeCommandName> = RuntimeCommandMap[K]['result']

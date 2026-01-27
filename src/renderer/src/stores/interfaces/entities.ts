/**
 * 实体 Store 接口定义
 * 包含 Page, Folder, Message, Account 等实体的 Store 接口
 */

import type { IEntityStore, ICachedStore, IResettable } from './base'
import type { PageRecord, MessagesRecord } from '../../persistence/interfaces/userData'
import type { PageFolder, ChatMessage, Topic, Account } from '../../types/type'

// ==================== Page Store ====================

/**
 * 页面创建数据
 */
export type PageCreateDTO = {
  id?: string // 可选，用于导入时保留原 ID
  name: string
  parentFolderId?: string
  order?: number
  starred?: boolean
}

/**
 * 页面 Store 接口
 */
export interface IPageStore extends IEntityStore<PageRecord, PageCreateDTO> {
  /**
   * 当前页面列表（只读）
   */
  readonly pages: PageRecord[]

  /**
   * 根据文件夹 ID 查询页面
   * @param folderId 文件夹 ID，undefined 表示根目录
   */
  findByFolderId(folderId: string | undefined): PageRecord[]
}

// ==================== Folder Store ====================

/**
 * 文件夹创建数据
 */
export type FolderCreateDTO = {
  id?: string // 可选，用于导入时保留原 ID
  name: string
  parentFolderId?: string
  order?: number
  expanded?: boolean
}

/**
 * 文件夹 Store 接口
 */
export interface IFolderStore extends IEntityStore<PageFolder, FolderCreateDTO> {
  /**
   * 当前文件夹列表（只读）
   */
  readonly folders: PageFolder[]

  /**
   * 根据父文件夹 ID 查询子文件夹
   * @param parentId 父文件夹 ID，undefined 表示根目录
   */
  findByParentId(parentId: string | undefined): PageFolder[]

  /**
   * 切换文件夹展开状态
   */
  toggleExpanded(id: string): Promise<void>
}

// ==================== Message Store ====================

/**
 * 消息 Store 接口
 * 基于缓存模式，按 pageId 管理消息
 */
export interface IMessageStore extends ICachedStore<MessagesRecord>, IResettable {
  // ==================== 核心操作 ====================

  /**
   * 函数式更新消息记录
   */
  update(pageId: string, updater: (record: MessagesRecord) => MessagesRecord): Promise<void>

  // ==================== 消息操作 ====================

  /**
   * 添加消息
   */
  addMessage(pageId: string, message: ChatMessage): Promise<void>

  /**
   * 更新消息
   */
  updateMessage(pageId: string, messageId: string, changes: Partial<ChatMessage>): Promise<void>

  /**
   * 删除消息
   */
  deleteMessages(pageId: string, messageIds: Set<string>): Promise<void>

  // ==================== 会话状态 ====================

  /**
   * 更新会话状态（leafMessageId, selectedMessageId）
   */
  updateSession(
    pageId: string,
    changes: Partial<Omit<MessagesRecord, 'pageId' | 'messages' | 'topics'>>
  ): Promise<void>

  // ==================== Topic 操作 ====================

  /**
   * 添加 Topic
   */
  addTopic(pageId: string, topic: Topic): Promise<void>

  /**
   * 更新 Topic
   */
  updateTopic(pageId: string, topicId: string, changes: Partial<Topic>): Promise<void>

  /**
   * 删除 Topic
   */
  deleteTopic(pageId: string, topicId: string): Promise<void>

  /**
   * 获取 Topics
   */
  getTopics(pageId: string): Topic[]

  // ==================== 持久化删除 ====================

  /**
   * 从数据库删除消息记录
   */
  removeRecord(pageId: string): Promise<void>
}

// ==================== Account Store ====================

/**
 * 账户创建数据
 */
export type AccountCreateDTO = {
  id?: string // 可选，用于创建特定 ID 的账户（如默认账户）
  name: string
  avatar?: string
}

/**
 * 账户 Store 接口
 */
export interface IAccountStore extends IEntityStore<Account, AccountCreateDTO> {
  /**
   * 当前账户列表（只读）
   */
  readonly accounts: Account[]

  /**
   * 当前激活的账户 ID
   */
  readonly currentAccountId: string | null

  /**
   * 设置当前账户
   */
  setCurrentAccountId(id: string | null): Promise<void>

  /**
   * 设置初始化状态
   * 用于标记整个账户系统（包括所有相关 stores）是否完成初始化
   */
  setInitialized(initialized: boolean): void
}

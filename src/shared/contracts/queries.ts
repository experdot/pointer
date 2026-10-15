/**
 * 查询契约（只读）
 */

import type {
  Account,
  Conversation,
  Folder,
  MessageQueue,
  Page,
  SearchOptions,
  SearchPageGroup,
  Settings,
  WorkspaceSummary
} from '../domain'
import type { ViewState } from './viewState'

export interface SessionSnapshot {
  accountId: string | null
  workspaceId: string | null
  workspacePath: string | null
}

export interface PageTreeSnapshot {
  folders: Folder[]
  pages: Page[]
}

export interface ModelCatalog {
  models: string[]
  error?: string
}

interface ConnectionCheck {
  ok: boolean
  message: string
}

export interface WorkspaceSearchResult {
  groups: SearchPageGroup[]
  total: number
}

export interface AttachmentContent {
  mimeType: string
  dataBase64: string
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

export interface UpdateCheckResult {
  /** 远端是否存在比本地更新的版本 */
  available: boolean
  version?: string
}

interface RuntimeQueryMap {
  'session.get': { payload: void; result: SessionSnapshot }
  'accounts.list': { payload: void; result: Account[] }
  'workspaces.list': { payload: void; result: WorkspaceSummary[] }
  'tree.get': { payload: void; result: PageTreeSnapshot }
  'conversation.get': { payload: { pageId: string }; result: Conversation }
  'settings.get': { payload: void; result: Settings }
  'viewState.get': { payload: void; result: ViewState }
  'queue.get': { payload: { pageId: string }; result: MessageQueue }
  'search.workspace': {
    payload: { query: string; options: SearchOptions }
    result: WorkspaceSearchResult
  }
  'ai.models': { payload: { llmId: string }; result: ModelCatalog }
  'ai.test': { payload: { llmId: string }; result: ConnectionCheck }
  'attachment.read': { payload: { relativePath: string }; result: AttachmentContent }
  'app.version': { payload: void; result: string }
  'app.updateStatus': { payload: void; result: UpdateStatus }
}

export type RuntimeQueryName = keyof RuntimeQueryMap
export type RuntimeQueryPayload<K extends RuntimeQueryName> = RuntimeQueryMap[K]['payload']
export type RuntimeQueryResult<K extends RuntimeQueryName> = RuntimeQueryMap[K]['result']

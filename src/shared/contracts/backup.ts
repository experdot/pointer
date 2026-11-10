import type { Conversation, Folder, Page, Settings } from '../domain'
import type { ViewState } from './viewState'

/** 保持既有 JSON 备份版本；附件仅保存引用。 */
export interface BackupData {
  version: string
  exportedAt: number
  data: {
    pages?: Page[]
    folders?: Folder[]
    messages?: Conversation[]
    settings?: Partial<Settings>
    viewState?: ViewState
  }
}

export interface BackupRestoreInput {
  backup: BackupData
  selection: {
    pages: string[]
    folders: string[]
    llm: string[]
    llmFolders: string[]
    models: string[]
    modelFolders: string[]
    ui: boolean
  }
  strategy: 'generate-new' | 'skip' | 'overwrite'
}

export interface BackupRestoreResult {
  counts: {
    pages: number
    folders: number
    messages: number
    configs: number
    configFolders: number
    skipped: number
  }
  ids: {
    pages: Record<string, string>
    folders: Record<string, string>
    llm: Record<string, string>
    llmFolders: Record<string, string>
    models: Record<string, string>
    modelFolders: Record<string, string>
  }
  warnings: string[]
  error?: string
}

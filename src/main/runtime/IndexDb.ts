/**
 * 工作区索引（SQLite）
 *
 * 索引只是派生数据：删除或损坏后重新扫描工作区即可重建，
 * 用户数据始终保存在 .pointer.md 文件中。
 */

import { DatabaseSync, type StatementSync } from 'node:sqlite'
import type { ChatMessage, MessageRole, Page } from '../../shared/domain'

export interface IndexedPage {
  id: string
  relPath: string
  mtime: number
}

export interface MessageCandidate {
  pageId: string
  messageId: string
  role: MessageRole
  createdAt: number
  title?: string
  content: string
}

interface MessageRow {
  id: string
  page_id: string
  role: string
  created_at: number
  title: string | null
  content: string
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  rel_path TEXT NOT NULL,
  mtime REAL NOT NULL,
  name TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_page ON messages(page_id);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  page_id UNINDEXED,
  content,
  tokenize = 'trigram'
);
`

function escapeFtsQuery(query: string): string {
  return `"${query.replace(/"/g, '""')}"`
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export class IndexDb {
  private readonly db: DatabaseSync
  private readonly insertMessage: StatementSync
  private readonly insertFts: StatementSync
  private readonly deleteFtsByMessage: StatementSync
  private readonly deleteFtsByPage: StatementSync
  private readonly deleteMessagesByPage: StatementSync
  private readonly deletePageRow: StatementSync
  private readonly upsertPageStatement: StatementSync
  private readonly listPagesStatement: StatementSync
  private readonly ftsQuery: StatementSync
  private readonly likeQuery: StatementSync
  private readonly allMessagesQuery: StatementSync

  constructor(file: string) {
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec(SCHEMA)

    this.insertMessage = this.db.prepare(
      `INSERT INTO messages (id, page_id, role, title, created_at, content)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         page_id = excluded.page_id,
         role = excluded.role,
         title = excluded.title,
         created_at = excluded.created_at,
         content = excluded.content`
    )
    this.insertFts = this.db.prepare(
      `INSERT INTO messages_fts (message_id, page_id, content) VALUES (?, ?, ?)`
    )
    this.deleteFtsByMessage = this.db.prepare(`DELETE FROM messages_fts WHERE message_id = ?`)
    this.deleteFtsByPage = this.db.prepare(`DELETE FROM messages_fts WHERE page_id = ?`)
    this.deleteMessagesByPage = this.db.prepare(`DELETE FROM messages WHERE page_id = ?`)
    this.deletePageRow = this.db.prepare(`DELETE FROM pages WHERE id = ?`)
    this.upsertPageStatement = this.db.prepare(
      `INSERT INTO pages (id, rel_path, mtime, name, starred, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         rel_path = excluded.rel_path,
         mtime = excluded.mtime,
         name = excluded.name,
         starred = excluded.starred,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`
    )
    this.listPagesStatement = this.db.prepare(`SELECT id, rel_path, mtime FROM pages`)
    this.ftsQuery = this.db.prepare(
      `SELECT m.id, m.page_id, m.role, m.created_at, m.title, m.content
       FROM messages_fts f
       JOIN messages m ON m.id = f.message_id
       WHERE f.content MATCH ?
       LIMIT ?`
    )
    this.likeQuery = this.db.prepare(
      `SELECT id, page_id, role, created_at, title, content
       FROM messages
       WHERE content LIKE ? ESCAPE '\\'
       LIMIT ?`
    )
    this.allMessagesQuery = this.db.prepare(
      `SELECT id, page_id, role, created_at, title, content FROM messages LIMIT ?`
    )
  }

  static open(file: string): IndexDb {
    return new IndexDb(file)
  }

  close(): void {
    try {
      this.db.close()
    } catch {
      // 关闭失败不影响退出流程
    }
  }

  listPages(): Map<string, IndexedPage> {
    const rows = this.listPagesStatement.all() as unknown as Array<{
      id: string
      rel_path: string
      mtime: number
    }>

    return new Map(
      rows.map((row) => [row.id, { id: row.id, relPath: row.rel_path, mtime: row.mtime }])
    )
  }

  upsertPage(page: Page, relPath: string, mtime: number): void {
    this.upsertPageStatement.run(
      page.id,
      relPath,
      mtime,
      page.name,
      page.starred ? 1 : 0,
      page.createdAt,
      page.updatedAt ?? null
    )
  }

  removePage(pageId: string): void {
    this.deletePageRow.run(pageId)
    this.deleteMessagesByPage.run(pageId)
    this.deleteFtsByPage.run(pageId)
  }

  retainPages(pageIds: ReadonlySet<string>): void {
    for (const pageId of this.listPages().keys()) {
      if (!pageIds.has(pageId)) this.removePage(pageId)
    }
  }

  replaceMessages(pageId: string, messages: readonly ChatMessage[]): void {
    this.deleteMessagesByPage.run(pageId)
    this.deleteFtsByPage.run(pageId)

    for (const message of messages) {
      this.insertMessage.run(
        message.id,
        pageId,
        message.role,
        message.title ?? null,
        message.createdAt,
        message.content
      )
      this.insertFts.run(message.id, pageId, message.content)
    }
  }

  /**
   * 检索候选消息
   * 索引只用于缩小范围，精确匹配（大小写/整词/正则）由领域层匹配器完成
   */
  searchCandidates(query: string, useFts: boolean, limit = 2000): MessageCandidate[] {
    const trimmed = query.trim()
    if (!trimmed) return []

    try {
      const rows = useFts
        ? (this.ftsQuery.all(escapeFtsQuery(trimmed), limit) as unknown as MessageRow[])
        : (this.likeQuery.all(`%${escapeLike(trimmed)}%`, limit) as unknown as MessageRow[])

      return rows.map(toCandidate)
    } catch (error) {
      console.warn('[runtime] 检索失败，回退到全量扫描：', error)
      return this.allMessages()
    }
  }

  /** 全量候选（正则检索等无法利用索引的场景） */
  allMessages(limit = 20000): MessageCandidate[] {
    try {
      const rows = this.allMessagesQuery.all(limit) as unknown as MessageRow[]
      return rows.map(toCandidate)
    } catch {
      return []
    }
  }

  /** 删除单条消息的索引（保留用于增量更新） */
  removeMessage(messageId: string): void {
    this.db.prepare(`DELETE FROM messages WHERE id = ?`).run(messageId)
    this.deleteFtsByMessage.run(messageId)
  }

  clear(): void {
    this.db.exec('DELETE FROM messages; DELETE FROM messages_fts; DELETE FROM pages;')
  }
}

function toCandidate(row: MessageRow): MessageCandidate {
  return {
    pageId: row.page_id,
    messageId: row.id,
    role: row.role as MessageRole,
    createdAt: row.created_at,
    title: row.title ?? undefined,
    content: row.content
  }
}

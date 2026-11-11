/**
 * 工作区索引（SQLite）
 *
 * 索引只是派生数据：删除或损坏后重新扫描工作区即可重建，
 * 用户数据始终保存在 .pointer.md 文件中。
 */

import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ChatMessage, MessageRole, Page } from '@shared/domain'

interface IndexedPage {
  id: string
  relPath: string
  mtime: number
}

interface MessageCandidate {
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
  id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (page_id, id)
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
    mkdirSync(dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    try {
      this.db.exec('PRAGMA journal_mode = WAL')
      const version = this.db.prepare('PRAGMA user_version').get()?.user_version
      if (version !== 2) {
        this.db.exec(
          'BEGIN; DROP TABLE IF EXISTS messages_fts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS pages;'
        )
        this.db.exec(SCHEMA)
        this.db.exec('PRAGMA user_version = 2; COMMIT;')
      } else {
        this.db.exec(SCHEMA)
        this.db.prepare('SELECT * FROM messages LIMIT 1').all()
      }
      const integrity = this.db.prepare('PRAGMA quick_check').all()
      if (integrity.some((row) => row.quick_check !== 'ok'))
        throw Object.assign(new Error('SQLite 索引完整性校验失败'), { errcode: 11 })
      this.insertMessage = this.db.prepare(
        `INSERT INTO messages (id, page_id, role, title, created_at, content)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(page_id, id) DO UPDATE SET
         role = excluded.role,
         title = excluded.title,
         created_at = excluded.created_at,
         content = excluded.content`
      )
      this.insertFts = this.db.prepare(
        `INSERT INTO messages_fts (message_id, page_id, content) VALUES (?, ?, ?)`
      )
      this.deleteFtsByMessage = this.db.prepare(
        `DELETE FROM messages_fts WHERE page_id = ? AND message_id = ?`
      )
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
       JOIN messages m ON m.id = f.message_id AND m.page_id = f.page_id
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
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  static open(file: string): IndexDb {
    try {
      return new IndexDb(file)
    } catch (error) {
      const rawCode = (error as { errcode?: number }).errcode
      const code = typeof rawCode === 'number' ? rawCode & 0xff : undefined
      if (code !== 11 && code !== 26) throw error
      const suffix = `.corrupt-${randomUUID()}`
      for (const part of ['', '-wal', '-shm']) {
        if (existsSync(file + part)) renameSync(file + part, file + suffix + part)
      }
      return new IndexDb(file)
    }
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
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE page_id = ?')
      .all(pageId) as unknown as MessageRow[]
    const previous = new Map(rows.map((row) => [row.id, row]))
    const ids = new Set(messages.map((message) => message.id))
    const removed = rows.filter((row) => !ids.has(row.id))
    const changed = messages.filter((message) => {
      const old = previous.get(message.id)
      return (
        !old ||
        old.role !== message.role ||
        old.title !== (message.title ?? null) ||
        old.created_at !== message.createdAt ||
        old.content !== message.content
      )
    })
    if (!removed.length && !changed.length) return
    this.db.exec('BEGIN')
    try {
      for (const row of removed) this.removeMessage(pageId, row.id)
      for (const message of changed) {
        this.insertMessage.run(
          message.id,
          pageId,
          message.role,
          message.title ?? null,
          message.createdAt,
          message.content
        )
        const old = previous.get(message.id)
        if (!old || old.content !== message.content) {
          this.deleteFtsByMessage.run(pageId, message.id)
          this.insertFts.run(message.id, pageId, message.content)
        }
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  /**
   * 检索候选消息
   * 索引只用于缩小范围，精确匹配（大小写/整词/正则）由领域层匹配器完成
   */
  searchCandidates(query: string, useFts: boolean, limit = -1): MessageCandidate[] {
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
  allMessages(limit = -1): MessageCandidate[] {
    try {
      const rows = this.allMessagesQuery.all(limit) as unknown as MessageRow[]
      return rows.map(toCandidate)
    } catch {
      return []
    }
  }

  /** 删除单条消息的索引（保留用于增量更新） */
  removeMessage(pageId: string, messageId: string): void {
    this.db.prepare(`DELETE FROM messages WHERE page_id = ? AND id = ?`).run(pageId, messageId)
    this.deleteFtsByMessage.run(pageId, messageId)
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

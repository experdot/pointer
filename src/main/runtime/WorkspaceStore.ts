/**
 * 工作区存储
 *
 * 职责：页面树（文件夹元数据 + 磁盘文件）、会话读写、磁盘与元数据对齐。
 * 约定：
 * - 磁盘文件是页面存在性的真相，.pointer/folders.json 是文件夹元数据的真相
 * - 全部写盘走原子写
 * - 磁盘布局是「文件夹 + 页面元数据」的纯函数（见 shared/domain/layout.ts）
 */

import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type {
  AttachmentRef,
  ChatMessage,
  Conversation,
  Folder,
  Page,
  PageTree,
  Workspace
} from '@shared/domain'
import {
  PAGE_FILE_FORMAT_VERSION,
  DEFAULT_FOLDER_NAME,
  DEFAULT_PAGE_NAME,
  addFolder,
  addPage,
  childrenOf,
  clearFolder as clearFolderInTree,
  computeWorkspaceLayout,
  directoryOfRelativePath,
  emptyConversation,
  isPageFileName,
  isReservedDirectory,
  moveTreeNode,
  nameKey,
  nextOrder,
  normalizeSiblingIndexes,
  parsePageFile,
  parsePageMetadata,
  replacePageMetadata,
  removeFolder as removeFolderInTree,
  removePages as removePagesInTree,
  sanitizeFileName,
  serializePageFile,
  uniqueName,
  updateFolder,
  updatePage,
  validateConversation,
  validatePageTree
} from '@shared/domain'
import { RuntimeError } from '@shared/contracts'
import type { NodePatch, RuntimeCommandPayload, TreeMoveConflict } from '@shared/contracts'
import type { PathResolver } from './paths'
import type { IndexDb } from './IndexDb'
import { SerialExecutor } from './SerialExecutor'
import { WorkspaceTransaction } from './WorkspaceTransaction'
import { assertRegularPath, assertSafeId, assertWithin } from './pathSafety'
import {
  ensureDir,
  isDirectory,
  mtimeOf,
  movePath,
  pathExists,
  readJson,
  readText,
  removePath,
  readBinary,
  walkFiles,
  writeBinaryAtomic,
  writeJsonAtomic,
  writeTextAtomic
} from './fsx'

interface FoldersFile {
  folders: Folder[]
}

export class WorkspaceStore {
  private readonly writes = new SerialExecutor()
  private readonly access = new AsyncLocalStorage<'read' | WorkspaceTransaction>()
  private transaction: WorkspaceTransaction | null = null
  private committedCallbacks: Array<() => void> | null = null
  private recoveryRequired = false
  /** 读取与写入共用串行队列，读取不创建回滚快照或磁盘事务。 */
  read<T>(operation: () => Promise<T> | T): Promise<T> {
    this.assertNotNested()
    return this.writes.run(() => {
      this.assertReady()
      return this.access.run('read', operation)
    })
  }

  /** 唯一事务入口；内部变更方法只执行操作，不再次入队。 */
  write<T>(operation: () => Promise<T> | T): Promise<T> {
    this.assertNotNested()
    return this.writes.run(async () => {
      this.assertReady()
      const before = {
        folders: this.folders,
        pages: this.pages,
        pagePaths: new Map(this.pagePaths),
        pageMtimes: new Map(this.pageMtimes),
        folderDirs: new Map(this.folderDirs),
        conversationCache: new Map(this.conversationCache)
      }
      const transaction = new WorkspaceTransaction(this.path)
      this.transaction = transaction
      const callbacks: Array<() => void> = []
      this.committedCallbacks = callbacks
      try {
        const result = await this.access.run(transaction, operation)
        await transaction.commit()
        this.transaction = null
        this.committedCallbacks = null
        for (const callback of callbacks) {
          try {
            callback()
          } catch (error) {
            console.error('[runtime] 提交后通知失败', error)
          }
        }
        return result
      } catch (error) {
        const failures: unknown[] = []
        try {
          await transaction.rollback()
        } catch (failure) {
          this.recoveryRequired = true
          failures.push(failure)
        }
        Object.assign(this, before)
        if (transaction.changed) {
          try {
            await this.syncIndex()
          } catch (failure) {
            failures.push(failure)
          }
        }
        if (failures.length)
          throw new AggregateError(
            [error, ...failures],
            '操作失败且部分文件恢复失败，请保留工作区并重试',
            { cause: error }
          )
        throw error
      } finally {
        this.transaction = null
        this.committedCallbacks = null
      }
    })
  }
  idle(): Promise<void> {
    return this.writes.idle()
  }

  private assertReady(): void {
    if (this.recoveryRequired)
      throw new RuntimeError('workspace.recovery-required', '文件恢复未完成，请重新打开工作区')
  }

  private assertNotNested(): void {
    if (this.access.getStore())
      throw new RuntimeError('workspace.nested-operation', '工作区操作不能重复入队')
  }

  private requireTransaction(): WorkspaceTransaction {
    if (!this.transaction || this.access.getStore() !== this.transaction)
      throw new RuntimeError('workspace.transaction-required', '工作区修改必须在写事务中执行')
    return this.transaction
  }

  afterCommit(callback: () => void): void {
    if (this.transaction && this.access.getStore() === this.transaction && this.committedCallbacks)
      this.committedCallbacks.push(callback)
    else callback()
  }

  async writeJson(path: string, value: unknown): Promise<void> {
    await this.trackWrite(path, () => writeJsonAtomic(path, value))
  }

  async mutateConversation<T>(
    pageId: string,
    change: (current: Conversation) => { conversation: Conversation; result: T }
  ): Promise<T> {
    this.requireTransaction()
    if (!this.getPage(pageId)) throw new RuntimeError('page.not-found', '页面不存在')
    const next = change(await this.readConversation(pageId))
    await this.writeConversation(next.conversation)
    return next.result
  }
  private folders: Folder[] = []
  private pages: Page[] = []
  /** pageId -> 相对工作区根目录的页面文件路径 */
  private pagePaths = new Map<string, string>()
  /** pageId -> 文件 mtime，用于索引增量与外部改动检测 */
  private pageMtimes = new Map<string, number>()
  /** folderId -> 相对目录路径 */
  private folderDirs = new Map<string, string>()
  /** 会话缓存：以文件 mtime 作为失效依据，避免重复解析同一文件 */
  private conversationCache = new Map<string, { mtime: number; conversation: Conversation }>()

  constructor(
    private readonly paths: PathResolver,
    private readonly workspace: Workspace,
    private readonly index: IndexDb
  ) {}

  get path(): string {
    return this.workspace.path
  }

  async open(): Promise<void> {
    await this.ensureStructure()
    await WorkspaceTransaction.recover(this.path)
    await this.write(async () => {
      await this.loadFolders()
      await this.scanFromDisk()
      await this.applyLayout()
      await this.syncIndex()
    })
  }

  close(): void {
    this.folders = []
    this.pages = []
    this.pagePaths.clear()
    this.pageMtimes.clear()
    this.folderDirs.clear()
    this.conversationCache.clear()
  }

  // ==================== 读取 ====================

  getTree(): PageTree {
    return {
      folders: this.folders.map((folder) => ({ ...folder })),
      pages: this.pages.map((page) => ({ ...page }))
    }
  }

  getPage(pageId: string): Page | undefined {
    const page = this.pages.find((item) => item.id === pageId)
    return page ? { ...page } : undefined
  }

  getFolder(folderId: string): Folder | undefined {
    const folder = this.folders.find((item) => item.id === folderId)
    return folder ? { ...folder } : undefined
  }

  pageIds(): string[] {
    return this.pages.map((page) => page.id)
  }

  relativePathOf(pageId: string): string | undefined {
    return this.pagePaths.get(pageId)
  }

  async readConversation(pageId: string): Promise<Conversation> {
    const relativePath = this.pagePaths.get(pageId)
    if (!relativePath) return emptyConversation(pageId)

    const absolutePath = this.absPath(relativePath)
    const mtime = await mtimeOf(absolutePath)
    if (mtime === null) return emptyConversation(pageId)

    const cached = this.conversationCache.get(pageId)
    if (cached && cached.mtime === mtime) {
      return cached.conversation
    }

    const text = await readText(absolutePath)
    if (text === null) return emptyConversation(pageId)

    const parsed = parsePageFile(text)
    if (!parsed.ok) {
      throw new RuntimeError('page.parse-failed', `页面文件无法解析：${relativePath}`, {
        reason: parsed.error
      })
    }

    const conversation = this.repairConversation({
      pageId,
      messages: parsed.value.messages,
      topics: parsed.value.topics,
      leafMessageId: parsed.value.leafMessageId,
      selectedMessageId: parsed.value.selectedMessageId
    })

    this.conversationCache.set(pageId, { mtime, conversation })
    return conversation
  }

  async writeConversation(conversation: Conversation): Promise<void> {
    this.requireTransaction()
    for (const message of conversation.messages) {
      for (const attachment of message.attachments ?? [])
        this.resolveAttachmentPath(attachment.relativePath)
    }
    const page = this.pages.find((item) => item.id === conversation.pageId)
    if (!page) {
      throw new RuntimeError('page.not-found', `页面不存在：${conversation.pageId}`)
    }

    const relativePath = this.pagePaths.get(page.id)
    if (!relativePath) {
      throw new RuntimeError('page.path-missing', `页面缺少文件路径：${page.id}`)
    }

    const content = serializePageFile({
      version: PAGE_FILE_FORMAT_VERSION,
      page,
      messages: conversation.messages,
      topics: conversation.topics,
      leafMessageId: conversation.leafMessageId,
      selectedMessageId: conversation.selectedMessageId
    })

    const absolutePath = this.absPath(relativePath)
    await this.trackWrite(absolutePath, () => writeTextAtomic(absolutePath, content))

    const mtime = (await mtimeOf(absolutePath)) ?? Date.now()
    this.pageMtimes.set(page.id, mtime)
    this.conversationCache.set(page.id, { mtime, conversation })
    this.index.upsertPage(page, relativePath, mtime)
    this.index.replaceMessages(page.id, conversation.messages)
  }

  // ==================== 页面与文件夹变更 ====================

  async createPage(
    input: {
      id?: string
      name?: string
      parentFolderId?: string
      afterNodeId?: string
      starred?: boolean
    },
    at: number
  ): Promise<Page> {
    this.requireTransaction()
    const parentFolderId = this.validatedFolderId(input.parentFolderId)
    if (input.id) {
      assertSafeId(input.id)
      if (this.getPage(input.id) || this.getFolder(input.id))
        throw new RuntimeError('page.id-conflict', '标识已存在')
    }
    const page: Page = {
      id: input.id ?? randomUUID(),
      kind: 'page',
      name: this.uniqueNameAt(parentFolderId, input.name?.trim() || DEFAULT_PAGE_NAME),
      starred: input.starred,
      parentFolderId,
      order: nextOrder(this.getTree(), parentFolderId),
      createdAt: at,
      updatedAt: at
    }

    this.pages = addPage(this.getTree(), page).pages
    const pagesBefore = this.pages
    const foldersBefore = this.folders
    this.positionNewNode(page.id, input.afterNodeId, at)
    await this.persistFoldersDiff(foldersBefore)
    await this.persistPageMetadataDiff(pagesBefore)
    await this.applyLayout()
    await this.writeConversation(emptyConversation(page.id))
    return this.getPage(page.id)!
  }

  async updatePage(pageId: string, patch: NodePatch, at: number): Promise<void> {
    this.requireTransaction()
    const page = this.pages.find((item) => item.id === pageId)
    if (!page) throw new RuntimeError('page.not-found', `页面不存在：${pageId}`)

    const updates: Partial<Page> = {}
    if (patch.name !== undefined && patch.name.trim() !== page.name) {
      updates.name = this.uniqueNameAt(page.parentFolderId, patch.name.trim(), pageId)
    }
    if (patch.starred !== undefined && patch.starred !== page.starred) {
      updates.starred = patch.starred
    }
    if (Object.keys(updates).length === 0) return

    const before = this.pages
    this.pages = updatePage(this.getTree(), pageId, updates, at).pages
    await this.persistPageMetadataDiff(before)
    await this.applyLayout()
    await this.syncIndexForPage(pageId)
  }

  async moveTreeNode(input: RuntimeCommandPayload<'tree.move'>, at: number): Promise<boolean> {
    this.requireTransaction()
    const before = this.getTree()
    const result = moveTreeNode(before, input, at)
    if (!result.ok) {
      throw new RuntimeError(result.error.code, result.error.message)
    }
    if (result.tree === before) return false

    let next = result.tree
    const moved = [...next.pages, ...next.folders].find((node) => node.id === input.nodeId)!
    const name = this.uniqueNameAt(moved.parentFolderId, moved.name, moved.id)
    if (name !== moved.name) {
      if (input.conflictPolicy !== 'rename') {
        const conflict: TreeMoveConflict = {
          nodeId: moved.id,
          kind: moved.kind,
          name: moved.name,
          targetFolderId: moved.parentFolderId
        }
        throw new RuntimeError('tree.name-conflict', '目标位置已有同名节点', conflict)
      }
      next =
        moved.kind === 'page'
          ? updatePage(next, moved.id, { name }, at)
          : updateFolder(next, moved.id, { name }, at)
    }

    this.folders = next.folders
    this.pages = next.pages
    await this.persistFoldersDiff(before.folders)
    await this.persistPageMetadataDiff(before.pages)
    const previousPaths = new Map(this.pagePaths)
    await this.applyLayout()
    // 布局可能同时移动文件夹下的页面；只刷新路径索引，不重建消息全文索引。
    for (const page of this.pages) {
      const relativePath = this.pagePaths.get(page.id)
      if (relativePath && previousPaths.get(page.id) !== relativePath) {
        this.index.upsertPage(page, relativePath, this.pageMtimes.get(page.id) ?? 0)
      }
    }
    return true
  }

  async deletePages(pageIds: readonly string[]): Promise<void> {
    this.requireTransaction()
    const existing = pageIds.filter((pageId) => this.pages.some((page) => page.id === pageId))

    for (const pageId of existing) {
      const relativePath = this.pagePaths.get(pageId)
      if (relativePath)
        await this.trackWrite(this.absPath(relativePath), () =>
          removePath(this.absPath(relativePath))
        )
      const queueFile = this.paths.queueFile(this.path, pageId)
      await this.trackWrite(queueFile, () => removePath(queueFile))
      this.index.removePage(pageId)
      this.pagePaths.delete(pageId)
      this.pageMtimes.delete(pageId)
    }

    this.pages = removePagesInTree(this.getTree(), existing).pages
    for (const pageId of existing) this.conversationCache.delete(pageId)
  }

  async clearConversations(): Promise<void> {
    this.requireTransaction()
    await this.deletePages(this.pageIds())
    const root = this.paths.queuesDir(this.path)
    for (const file of await walkFiles(root, { include: (name) => name.endsWith('.json') })) {
      assertWithin(root, file.absolutePath)
      await this.trackWrite(file.absolutePath, () => removePath(file.absolutePath))
    }
  }

  async createFolder(
    input: { id?: string; name?: string; parentFolderId?: string; afterNodeId?: string },
    at: number
  ): Promise<Folder> {
    this.requireTransaction()
    this.assertFolderName(input.name ?? DEFAULT_FOLDER_NAME)
    if (input.id) {
      assertSafeId(input.id)
      if (this.getPage(input.id) || this.getFolder(input.id))
        throw new RuntimeError('folder.id-conflict', '标识已存在')
    }
    const parentFolderId = this.validatedFolderId(input.parentFolderId)
    const folder: Folder = {
      id: input.id ?? randomUUID(),
      kind: 'folder',
      name: this.uniqueNameAt(parentFolderId, input.name?.trim() || DEFAULT_FOLDER_NAME),
      parentFolderId,
      order: nextOrder(this.getTree(), parentFolderId),
      createdAt: at,
      updatedAt: at
    }

    this.folders = addFolder(this.getTree(), folder).folders
    const before = this.pages
    this.positionNewNode(folder.id, input.afterNodeId, at)
    await this.persistPageMetadataDiff(before)
    await this.persistFolders()
    await this.applyLayout()
    return this.getFolder(folder.id)!
  }

  async updateFolder(folderId: string, patch: NodePatch, at: number): Promise<void> {
    this.requireTransaction()
    if (patch.name !== undefined) this.assertFolderName(patch.name)
    const folder = this.folders.find((item) => item.id === folderId)
    if (!folder) throw new RuntimeError('folder.not-found', `文件夹不存在：${folderId}`)
    if (patch.name === undefined || patch.name.trim() === folder.name) return

    const name = this.uniqueNameAt(folder.parentFolderId, patch.name.trim(), folderId)
    this.folders = updateFolder(this.getTree(), folderId, { name }, at).folders
    await this.persistFolders()
    await this.applyLayout()
  }

  /**
   * 删除文件夹
   * promote：仅删除该文件夹，内容提升到根目录
   * cascade：连同内容一起删除
   * 返回被删除的页面 id
   */
  async deleteFolders(
    folderIds: readonly string[],
    mode: 'promote' | 'cascade',
    at: number
  ): Promise<string[]> {
    this.requireTransaction()
    const before = this.pages.map((page) => page.id)
    let tree = this.getTree()
    for (const folderId of folderIds) {
      tree = removeFolderInTree(tree, folderId, mode, at)
    }
    if (mode === 'promote') {
      const previous = new Map(
        [...this.folders, ...this.pages].map((node) => [node.id, node.parentFolderId])
      )
      const names = new Map<string | undefined, Set<string>>()
      const renamed = new Map<string, string>()
      const nodes = [...tree.folders, ...tree.pages].sort(
        (a, b) =>
          Number(previous.get(a.id) !== a.parentFolderId) -
          Number(previous.get(b.id) !== b.parentFolderId)
      )
      for (const node of nodes) {
        const taken = names.get(node.parentFolderId) ?? new Set<string>()
        const name = uniqueName(taken, node.name)
        taken.add(nameKey(name))
        names.set(node.parentFolderId, taken)
        renamed.set(node.id, name)
      }
      tree = {
        folders: tree.folders.map((node) => ({ ...node, name: renamed.get(node.id)! })),
        pages: tree.pages.map((node) => ({ ...node, name: renamed.get(node.id)! }))
      }
    }

    const remaining = new Set(tree.pages.map((page) => page.id))
    const removedPageIds = before.filter((pageId) => !remaining.has(pageId))

    const pagesBefore = this.pages
    await this.deletePages(removedPageIds)
    this.folders = tree.folders
    this.pages = tree.pages
    await this.persistFolders()
    // promote 模式下被提升的页面 parentFolderId 变了，同样要落盘
    await this.persistPageMetadataDiff(pagesBefore)
    await this.applyLayout()
    await this.syncIndex()
    return removedPageIds
  }

  async clearFolder(folderId: string): Promise<string[]> {
    this.requireTransaction()
    if (!this.folders.some((folder) => folder.id === folderId)) {
      throw new RuntimeError('folder.not-found', `文件夹不存在：${folderId}`)
    }

    const tree = clearFolderInTree(this.getTree(), folderId)
    const remaining = new Set(tree.pages.map((page) => page.id))
    const removedPageIds = this.pages
      .map((page) => page.id)
      .filter((pageId) => !remaining.has(pageId))

    await this.deletePages(removedPageIds)
    this.folders = tree.folders
    this.pages = tree.pages
    await this.persistFolders()
    await this.applyLayout()
    await this.syncIndex()
    return removedPageIds
  }

  // ==================== 外部改动 ====================

  /** 单次扫描产生差异并完成索引同步；普通读取只更新会话缓存。 */
  async reconcileExternalChanges(): Promise<{ pageIds: string[]; treeChanged: boolean }> {
    this.requireTransaction()
    const previous = new Map(this.pageMtimes)
    const paths = new Map(this.pagePaths)
    // 磁盘遍历顺序、对象字段顺序及可选字段缺省不能被误报为外部改动。
    const nodesById = (): Map<string, Record<string, unknown>> =>
      new Map(
        [...this.folders, ...this.pages].map((node) => [
          node.id,
          Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined))
        ])
      )
    const oldTree = nodesById()
    await this.loadFolders()
    await this.scanFromDisk()
    const changed = new Set<string>()
    for (const id of new Set([...previous.keys(), ...this.pageMtimes.keys()])) {
      if (previous.get(id) !== this.pageMtimes.get(id) || paths.get(id) !== this.pagePaths.get(id))
        changed.add(id)
    }
    const treeChanged = !isDeepStrictEqual(oldTree, nodesById())
    if (!changed.size && !treeChanged) return { pageIds: [], treeChanged: false }
    await this.applyLayout()
    this.index.retainPages(new Set(this.pageIds()))
    for (const id of this.conversationCache.keys()) {
      if (!this.getPage(id)) this.conversationCache.delete(id)
    }

    for (const pageId of changed) {
      if (!this.pages.some((page) => page.id === pageId)) continue
      await this.syncIndexForPage(pageId)
    }
    return { pageIds: [...changed], treeChanged }
  }

  // ==================== 附件 ====================

  resolveAttachmentPath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/')
    const parts = normalized.split('/')
    if (parts.length !== 3 || parts[0] !== '.pointer' || parts[1] !== 'attachments') {
      throw new RuntimeError('attachment.invalid-path', `非法附件路径：${relativePath}`)
    }
    assertSafeId(parts[2])
    const target = this.absPath(normalized)
    assertWithin(this.paths.attachmentsDir(this.path), target)
    return target
  }

  async validateAttachmentPath(relativePath: string, missing = false): Promise<string> {
    const target = this.resolveAttachmentPath(relativePath)
    await assertRegularPath(this.path, target, missing)
    return target
  }

  async importAttachments(
    files: ReadonlyArray<{ name: string; mimeType: string; dataBase64: string }>,
    at: number
  ): Promise<AttachmentRef[]> {
    this.requireTransaction()
    const attachmentsDir = this.paths.attachmentsDir(this.path)
    await ensureDir(attachmentsDir)

    const results: AttachmentRef[] = []
    for (const file of files) {
      const extensions: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp'
      }
      const extension = extensions[file.mimeType]
      if (!extension)
        throw new RuntimeError('attachment.invalid-type', '仅支持 PNG、JPEG、GIF 和 WebP 图片')
      if (file.dataBase64.length > Math.ceil((10 * 1024 * 1024) / 3) * 4)
        throw new RuntimeError('attachment.too-large', '附件不能超过 10 MB')
      const id = randomUUID()
      const fileName = `${id}-${sanitizeFileName(file.name)}.${extension}`
      const buffer = Buffer.from(file.dataBase64, 'base64')
      if (!file.dataBase64 || buffer.toString('base64') !== file.dataBase64)
        throw new RuntimeError('attachment.invalid-data', '附件内容不是有效的 Base64')
      if (buffer.byteLength > 10 * 1024 * 1024)
        throw new RuntimeError('attachment.too-large', '附件不能超过 10 MB')
      await this.validateAttachmentPath(this.paths.attachmentRelativePath(fileName), true)
      const target = join(attachmentsDir, fileName)
      await this.requireTransaction().capture(target)
      await writeBinaryAtomic(target, buffer)

      results.push({
        id,
        name: file.name,
        mimeType: file.mimeType,
        size: buffer.byteLength,
        relativePath: this.paths.attachmentRelativePath(fileName),
        createdAt: at
      })
    }

    return results
  }

  /** 删除附件文件 */
  async deleteAttachment(relativePath: string): Promise<void> {
    this.requireTransaction()
    const target = await this.validateAttachmentPath(relativePath, true)
    await this.requireTransaction().capture(target)
    await removePath(target)
  }

  /** 读取附件并编码为 data URL，供模型请求内联图片 */
  async readAttachmentAsDataUrl(attachment: AttachmentRef): Promise<string | null> {
    const buffer = await readBinary(
      await this.validateAttachmentPath(attachment.relativePath, true)
    )
    if (!buffer) return null
    return `data:${attachment.mimeType};base64,${buffer.toString('base64')}`
  }

  // ==================== 内部实现 ====================

  private absPath(relativePath: string): string {
    return join(this.path, ...relativePath.split('/'))
  }

  /**
   * 把发生变化的页面元数据写回文件
   *
   * 页面文件里的 <pointer-page> 块才是元数据（name/starred/order/parentFolderId）的
   * 权威副本；不写回的话，任何一次目录扫描都会用磁盘上的旧值覆盖内存
   * ——迁移前"加星后改名星标消失"就是这么来的。
   */
  private async persistPageMetadataDiff(before: readonly Page[]): Promise<void> {
    const previous = new Map(before.map((page) => [page.id, page]))

    for (const page of this.pages) {
      const old = previous.get(page.id)
      if (!old) continue
      if (
        old.name === page.name &&
        old.starred === page.starred &&
        old.order === page.order &&
        old.parentFolderId === page.parentFolderId
      ) {
        continue
      }
      await this.writePageMetadata(page.id)
    }
  }

  /** 只重写页面文件里的元数据块，正文保持原样 */
  private async writePageMetadata(pageId: string): Promise<void> {
    const relativePath = this.pagePaths.get(pageId)
    const page = this.pages.find((item) => item.id === pageId)
    if (!relativePath || !page) return

    const absolutePath = this.absPath(relativePath)
    const text = (await readText(absolutePath)) ?? ''
    // 当前树已经应用本次命令，读取会话正文时不能用磁盘中的旧元数据覆盖它。
    const conversation = await this.readConversation(pageId)

    const contentChanged = this.conversationCache.get(pageId)?.mtime !== this.pageMtimes.get(pageId)

    const next = replacePageMetadata(text, {
      version: PAGE_FILE_FORMAT_VERSION,
      page,
      topics: conversation.topics,
      leafMessageId: conversation.leafMessageId,
      selectedMessageId: conversation.selectedMessageId
    })

    await this.trackWrite(absolutePath, () => writeTextAtomic(absolutePath, next))

    const mtime = (await mtimeOf(absolutePath)) ?? Date.now()
    this.pageMtimes.set(pageId, mtime)
    this.conversationCache.set(pageId, { mtime, conversation })
    this.index.upsertPage(page, relativePath, mtime)
    if (contentChanged) this.index.replaceMessages(pageId, conversation.messages)
  }

  /** 页面置顶；文件夹在根层置顶、在子目录追加；显式参照优先。 */
  private positionNewNode(nodeId: string, afterNodeId: string | undefined, at: number): void {
    const tree = this.getTree()
    const node =
      tree.pages.find((item) => item.id === nodeId) ??
      tree.folders.find((item) => item.id === nodeId)!
    if (
      afterNodeId &&
      !childrenOf(tree, node.parentFolderId).some((item) => item.id === afterNodeId)
    )
      throw new RuntimeError('tree.invalid-target', '新建节点的参照项必须位于同一文件夹')
    const result = moveTreeNode(
      tree,
      afterNodeId
        ? { nodeId, targetNodeId: afterNodeId, placement: 'after' }
        : {
            nodeId,
            targetNodeId: node.parentFolderId,
            placement: node.kind === 'page' || !node.parentFolderId ? 'inside' : 'end'
          },
      at
    )
    if (!result.ok) throw new RuntimeError(result.error.code, result.error.message)
    this.pages = result.tree.pages
    this.folders = result.tree.folders
  }

  private async ensureStructure(): Promise<void> {
    await ensureDir(this.path)
    await ensureDir(this.paths.pointerDir(this.path))
    await ensureDir(this.paths.attachmentsDir(this.path))
    await ensureDir(this.paths.queuesDir(this.path))
  }

  private async loadFolders(): Promise<void> {
    const file = await readJson<FoldersFile>(this.paths.foldersFile(this.path))
    this.folders = file?.folders ?? []
  }

  private async persistFolders(): Promise<void> {
    const path = this.paths.foldersFile(this.path)
    await this.trackWrite(path, () =>
      writeJsonAtomic(path, {
        folders: this.folders
      } satisfies FoldersFile)
    )
  }

  /** 为一个命令中的多次文件变更保留撤销内容，避免只回滚内存而留下半完成磁盘状态。 */
  private async trackWrite(path: string, write: () => Promise<void>): Promise<void> {
    await this.requireTransaction().capture(path)
    await write()
  }

  private async trackMove(from: string, to: string): Promise<void> {
    await this.requireTransaction().capture(from)
    await this.requireTransaction().capture(to)
    await movePath(from, to)
  }

  /**
   * 把顺序发生变化的文件夹元数据写回 folders.json
   *
   * 在同级插入节点会重排后续兄弟的 order（文件夹也在内），不写回的话
   * folders.json 会与内存状态漂移，重开工作区后顺序被打回旧值。
   */
  private async persistFoldersDiff(before: readonly Folder[]): Promise<void> {
    const previous = new Map(before.map((folder) => [folder.id, folder]))
    const changed = this.folders.some((folder) => {
      const old = previous.get(folder.id)
      return (
        !old ||
        old.name !== folder.name ||
        old.order !== folder.order ||
        old.parentFolderId !== folder.parentFolderId
      )
    })
    if (changed) await this.persistFolders()
  }

  /** 扫描页面和目录元数据，调用方负责比较差异并同步索引。 */
  private async scanFromDisk(): Promise<void> {
    this.folderDirs = computeWorkspaceLayout({ folders: this.folders, pages: [] }).folderDirs

    const files = await walkFiles(this.path, { include: isPageFileName })
    const pages: Page[] = []
    const pagePaths = new Map<string, string>()
    const pageMtimes = new Map<string, number>()
    let foldersChanged = false

    for (const file of files) {
      const directory = directoryOfRelativePath(file.relativePath)
      let folderId = this.folderIdForDir(directory)
      if (directory && !folderId) {
        folderId = await this.ensureFolderChain(directory, file.modifiedAt)
        foldersChanged = true
      }

      const text = await readText(file.absolutePath)
      if (text === null) continue
      const parsed = parsePageMetadata(text)
      if (!parsed.ok) continue
      assertSafeId(parsed.value.page.id)
      if (pagePaths.has(parsed.value.page.id)) continue

      pages.push({ ...parsed.value.page, parentFolderId: folderId })
      pagePaths.set(parsed.value.page.id, file.relativePath)
      pageMtimes.set(parsed.value.page.id, file.modifiedAt)
    }

    this.pages = pages
    this.pagePaths = pagePaths
    this.pageMtimes = pageMtimes

    if (foldersChanged) await this.persistFolders()
    await this.removeOrphanFolders()

    const diagnostics = validatePageTree(this.getTree())
    if (diagnostics.length > 0) {
      console.warn('[runtime] 页面树存在异常：', diagnostics.slice(0, 5))
    }
  }

  private folderIdForDir(directory: string): string | undefined {
    if (!directory) return undefined
    for (const [folderId, dir] of this.folderDirs) {
      if (dir === directory) return folderId
    }
    return undefined
  }

  /** 为磁盘上已存在但元数据缺失的目录补建文件夹链 */
  private async ensureFolderChain(directory: string, at: number): Promise<string | undefined> {
    const segments = directory.split('/').filter(Boolean)
    let parentFolderId: string | undefined
    let parentDir = ''

    for (const segment of segments) {
      const currentDir = parentDir ? `${parentDir}/${segment}` : segment
      const existing = this.folderIdForDir(currentDir)
      if (existing) {
        parentFolderId = existing
        parentDir = currentDir
        continue
      }

      const folder: Folder = {
        id: randomUUID(),
        kind: 'folder',
        name: segment,
        parentFolderId,
        order: nextOrder(this.getTree(), parentFolderId),
        createdAt: at
      }
      this.folders = addFolder(this.getTree(), folder).folders
      this.folderDirs.set(folder.id, currentDir)
      parentFolderId = folder.id
      parentDir = currentDir
    }

    return parentFolderId
  }

  /** 移除磁盘上已不存在的文件夹 */
  private async removeOrphanFolders(): Promise<void> {
    const kept: Folder[] = []
    for (const folder of this.folders) {
      const dir = this.folderDirs.get(folder.id)
      if (!dir || (await isDirectory(this.absPath(dir)))) kept.push(folder)
    }

    if (kept.length !== this.folders.length) {
      this.folders = kept
      await this.persistFolders()
    }
  }

  /** 对齐磁盘布局：移动页面文件并清理空目录 */
  private async applyLayout(): Promise<void> {
    const layout = computeWorkspaceLayout({ folders: this.folders, pages: this.pages })
    const previousDirectories = new Set(this.folderDirs.values())
    this.folderDirs = layout.folderDirs

    for (const dir of new Set(layout.folderDirs.values())) {
      if (!(await isDirectory(this.absPath(dir))))
        await this.requireTransaction().capture(this.absPath(dir), 'directory')
      await ensureDir(this.absPath(dir))
    }

    const pending = this.pages.filter((page) => {
      const desired = layout.pagePaths.get(page.id)
      return desired !== undefined && this.pagePaths.get(page.id) !== desired
    })

    // 先腾空所有源位置，交换路径或循环移动也不会互相覆盖。
    const staging = join(this.paths.pointerDir(this.path), `layout-${randomUUID()}`)
    const staged = new Map<string, string>()
    if (pending.length) {
      await this.requireTransaction().capture(staging, 'directory')
      await ensureDir(staging)
      for (const page of pending) {
        const from = this.pagePaths.get(page.id)
        if (!from || !(await pathExists(this.absPath(from)))) continue
        const temporary = join(staging, page.id)
        await this.trackMove(this.absPath(from), temporary)
        staged.set(page.id, temporary)
      }
      for (const page of pending) {
        const desired = layout.pagePaths.get(page.id)!
        const target = this.absPath(desired)
        if (await pathExists(target))
          throw new RuntimeError('workspace.path-conflict', `目标文件已存在：${desired}`)
        const temporary = staged.get(page.id)
        if (temporary) await this.trackMove(temporary, target)
        this.pagePaths.set(page.id, desired)
      }
      await this.removeEmptyDirectory(staging)
    }

    await this.pruneEmptyDirectories(previousDirectories, new Set(layout.folderDirs.values()))
  }

  private async pruneEmptyDirectories(
    previous: ReadonlySet<string>,
    keep: ReadonlySet<string>
  ): Promise<void> {
    // 只清理由本工作区元数据曾经管理的目录，不能扫描并删除用户的无关空目录。
    const directories = [...previous]
    directories.sort((a, b) => b.split('/').length - a.split('/').length)
    for (const dir of directories) {
      if (keep.has(dir)) continue
      await this.requireTransaction().capture(this.absPath(dir), 'directory')
      await this.removeEmptyDirectory(this.absPath(dir))
    }
  }

  private async removeEmptyDirectory(path: string): Promise<void> {
    await rmdir(path).catch((error: NodeJS.ErrnoException) => {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code ?? '')) throw error
    })
  }

  /** 索引同步：仅重新解析变化过的页面 */
  private async syncIndex(): Promise<void> {
    this.index.retainPages(new Set(this.pages.map((page) => page.id)))
    const indexed = this.index.listPages()

    for (const page of this.pages) {
      const relativePath = this.pagePaths.get(page.id)
      if (!relativePath) continue

      const mtime = this.pageMtimes.get(page.id) ?? 0
      const existing = indexed.get(page.id)
      if (existing && existing.relPath === relativePath && existing.mtime === mtime) continue

      await this.syncIndexForPage(page.id)
    }
  }

  private async syncIndexForPage(pageId: string): Promise<void> {
    const relativePath = this.pagePaths.get(pageId)
    if (!relativePath) return

    const conversation = await this.readConversation(pageId)
    const page = this.pages.find((item) => item.id === pageId)
    if (!page) return

    const mtime = this.conversationCache.get(pageId)?.mtime ?? Date.now()
    this.index.upsertPage(page, relativePath, mtime)
    this.index.replaceMessages(pageId, conversation.messages)
    this.pageMtimes.set(pageId, mtime)
  }

  /** 读取到的会话可能被外部编辑破坏，尽量修复到合法状态 */
  private repairConversation(conversation: Conversation): Conversation {
    const diagnostics = validateConversation(conversation)
    if (diagnostics.length === 0) return conversation

    const normalized = normalizeSiblingIndexes(this.dedupeMessages(conversation), Date.now())
    const remaining = validateConversation(normalized)

    if (remaining.length > 0) {
      console.warn('[runtime] 会话存在未修复的问题：', remaining.slice(0, 5))
    }

    return normalized
  }

  /** 丢弃重复 id 的消息 */
  private dedupeMessages(conversation: Conversation): Conversation {
    const seen = new Set<string>()
    const unique: ChatMessage[] = []

    for (const message of conversation.messages) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      unique.push(message)
    }

    if (unique.length === conversation.messages.length) return conversation
    return { ...conversation, messages: unique }
  }

  private validatedFolderId(folderId: string | undefined): string | undefined {
    if (!folderId) return undefined
    if (!this.folders.some((folder) => folder.id === folderId)) {
      throw new RuntimeError('folder.not-found', `文件夹不存在：${folderId}`)
    }
    return folderId
  }

  private assertFolderName(name: string): void {
    if (isReservedDirectory(sanitizeFileName(name))) {
      throw new RuntimeError('folder.reserved-name', '该名称保留给系统目录')
    }
  }

  /** 同级节点（文件夹与页面）共享名称空间，避免界面上出现同名条目 */
  private uniqueNameAt(
    parentFolderId: string | undefined,
    desired: string,
    excludeId?: string
  ): string {
    const siblings = childrenOf(this.getTree(), parentFolderId).filter(
      (node) => node.id !== excludeId
    )
    const taken = new Set(siblings.map((node) => nameKey(node.name)))
    return uniqueName(taken, desired)
  }
}

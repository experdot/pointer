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
import { join } from 'node:path'
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
  moveNode,
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
  updateNode,
  validateConversation,
  validatePageTree
} from '@shared/domain'
import { RuntimeError } from '@shared/contracts'
import type { PathResolver } from './paths'
import type { IndexDb } from './IndexDb'
import {
  ensureDir,
  isDirectory,
  listDirectories,
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

interface NodeMetadataPatch {
  name?: string
  starred?: boolean
}

export class WorkspaceStore {
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
    await this.loadFolders()
    await this.migrateLegacyPagesDirectory()
    await this.scanFromDisk()
    await this.applyLayout()
    await this.syncIndex()
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
      this.pageMtimes.set(pageId, mtime)
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

    this.refreshPageFromDocument(pageId, parsed.value.page)

    const conversation = this.repairConversation({
      pageId,
      messages: parsed.value.messages,
      topics: parsed.value.topics,
      leafMessageId: parsed.value.leafMessageId,
      selectedMessageId: parsed.value.selectedMessageId
    })

    this.conversationCache.set(pageId, { mtime, conversation })
    this.pageMtimes.set(pageId, mtime)
    return conversation
  }

  async writeConversation(conversation: Conversation): Promise<void> {
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
    await writeTextAtomic(absolutePath, content)

    const mtime = (await mtimeOf(absolutePath)) ?? Date.now()
    this.pageMtimes.set(page.id, mtime)
    this.conversationCache.set(page.id, { mtime, conversation })
    this.index.upsertPage(page, relativePath, mtime)
    this.index.replaceMessages(page.id, conversation.messages)
  }

  // ==================== 页面与文件夹变更 ====================

  async createPage(
    input: { name?: string; parentFolderId?: string; afterNodeId?: string; starred?: boolean },
    at: number
  ): Promise<Page> {
    const parentFolderId = this.validatedFolderId(input.parentFolderId)
    const page: Page = {
      id: randomUUID(),
      kind: 'page',
      name: this.uniqueNameAt(parentFolderId, input.name?.trim() || DEFAULT_PAGE_NAME),
      starred: input.starred,
      parentFolderId,
      order: nextOrder(this.getTree(), parentFolderId),
      createdAt: at,
      updatedAt: at
    }

    this.pages = addPage(this.getTree(), page).pages
    const before = this.pages
    await this.applyInsertPosition(page.id, input.afterNodeId, parentFolderId, at)
    await this.persistPageMetadataDiff(before)
    await this.applyLayout()
    await this.writeConversation(emptyConversation(page.id))
    return { ...page }
  }

  async updatePage(pageId: string, patch: NodeMetadataPatch, at: number): Promise<void> {
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
    this.pages = updateNode(this.getTree(), pageId, updates, at).pages
    await this.persistPageMetadataDiff(before)
    await this.applyLayout()
    await this.syncIndexForPage(pageId)
  }

  async movePage(
    pageId: string,
    targetFolderId: string | undefined,
    beforeNodeId: string | undefined,
    at: number
  ): Promise<void> {
    if (!this.pages.some((page) => page.id === pageId)) {
      throw new RuntimeError('page.not-found', `页面不存在：${pageId}`)
    }

    const tree = moveNode(
      this.getTree(),
      pageId,
      this.validatedFolderId(targetFolderId),
      beforeNodeId,
      at
    )
    const before = this.pages
    this.folders = tree.folders
    this.pages = tree.pages
    await this.persistFolders()
    await this.persistPageMetadataDiff(before)
    await this.applyLayout()
    await this.syncIndexForPage(pageId)
  }

  async deletePages(pageIds: readonly string[]): Promise<void> {
    const existing = pageIds.filter((pageId) => this.pages.some((page) => page.id === pageId))

    for (const pageId of existing) {
      const relativePath = this.pagePaths.get(pageId)
      if (relativePath) await removePath(this.absPath(relativePath))
      await removePath(this.paths.queueFile(this.path, pageId))
      this.index.removePage(pageId)
      this.pagePaths.delete(pageId)
      this.pageMtimes.delete(pageId)
    }

    this.pages = removePagesInTree(this.getTree(), existing).pages
  }

  async createFolder(
    input: { name?: string; parentFolderId?: string; afterNodeId?: string },
    at: number
  ): Promise<Folder> {
    const parentFolderId = this.validatedFolderId(input.parentFolderId)
    const folder: Folder = {
      id: randomUUID(),
      kind: 'folder',
      name: this.uniqueNameAt(parentFolderId, input.name?.trim() || DEFAULT_FOLDER_NAME),
      parentFolderId,
      order: nextOrder(this.getTree(), parentFolderId),
      createdAt: at,
      updatedAt: at
    }

    this.folders = addFolder(this.getTree(), folder).folders
    const before = this.pages
    await this.applyInsertPosition(folder.id, input.afterNodeId, parentFolderId, at)
    await this.persistPageMetadataDiff(before)
    await this.persistFolders()
    await this.applyLayout()
    return { ...folder }
  }

  async updateFolder(folderId: string, patch: NodeMetadataPatch, at: number): Promise<void> {
    const folder = this.folders.find((item) => item.id === folderId)
    if (!folder) throw new RuntimeError('folder.not-found', `文件夹不存在：${folderId}`)
    if (patch.name === undefined || patch.name.trim() === folder.name) return

    const name = this.uniqueNameAt(folder.parentFolderId, patch.name.trim(), folderId)
    this.folders = updateNode(this.getTree(), folderId, { name }, at).folders
    await this.persistFolders()
    await this.applyLayout()
  }

  async moveFolder(
    folderId: string,
    targetFolderId: string | undefined,
    beforeNodeId: string | undefined,
    at: number
  ): Promise<void> {
    if (!this.folders.some((folder) => folder.id === folderId)) {
      throw new RuntimeError('folder.not-found', `文件夹不存在：${folderId}`)
    }

    const tree = moveNode(
      this.getTree(),
      folderId,
      this.validatedFolderId(targetFolderId),
      beforeNodeId,
      at
    )
    const before = this.pages
    this.folders = tree.folders
    this.pages = tree.pages
    await this.persistFolders()
    await this.persistPageMetadataDiff(before)
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
    mode: 'promote' | 'cascade'
  ): Promise<string[]> {
    const before = this.pages.map((page) => page.id)
    let tree = this.getTree()
    for (const folderId of folderIds) {
      tree = removeFolderInTree(tree, folderId, mode)
    }

    const remaining = new Set(tree.pages.map((page) => page.id))
    const removedPageIds = before.filter((pageId) => !remaining.has(pageId))

    const pagesBefore = this.pages
    this.folders = tree.folders
    this.pages = tree.pages
    await this.persistFolders()
    await this.deletePages(removedPageIds)
    // promote 模式下被提升的页面 parentFolderId 变了，同样要落盘
    await this.persistPageMetadataDiff(pagesBefore)
    await this.applyLayout()
    await this.syncIndex()
    return removedPageIds
  }

  async clearFolder(folderId: string): Promise<string[]> {
    if (!this.folders.some((folder) => folder.id === folderId)) {
      throw new RuntimeError('folder.not-found', `文件夹不存在：${folderId}`)
    }

    const tree = clearFolderInTree(this.getTree(), folderId)
    const remaining = new Set(tree.pages.map((page) => page.id))
    const removedPageIds = this.pages
      .map((page) => page.id)
      .filter((pageId) => !remaining.has(pageId))

    this.folders = tree.folders
    this.pages = tree.pages
    await this.persistFolders()
    await this.deletePages(removedPageIds)
    await this.applyLayout()
    await this.syncIndex()
    return removedPageIds
  }

  // ==================== 外部改动 ====================

  /** 对比文件 mtime 与内存记录，返回内容发生变化的页面 id */
  async detectExternalChanges(): Promise<string[]> {
    const changed: string[] = []

    for (const page of this.pages) {
      const relativePath = this.pagePaths.get(page.id)
      if (!relativePath) continue
      const mtime = await mtimeOf(this.absPath(relativePath))
      if (mtime === null || this.pageMtimes.get(page.id) !== mtime) {
        changed.push(page.id)
      }
    }

    if (changed.length === 0) {
      const structureChanged = await this.scanFromDisk()
      if (structureChanged) changed.push(...this.pageIds())
    }

    return changed
  }

  /** 外部改动后重新读取磁盘并同步索引 */
  async reload(changedPageIds: readonly string[]): Promise<void> {
    await this.scanFromDisk()
    await this.applyLayout()

    for (const pageId of changedPageIds) {
      if (!this.pages.some((page) => page.id === pageId)) continue
      await this.syncIndexForPage(pageId)
    }
  }

  // ==================== 附件 ====================

  resolveAttachmentPath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    if (normalized.split('/').includes('..')) {
      throw new RuntimeError('attachment.invalid-path', `非法附件路径：${relativePath}`)
    }
    return this.absPath(normalized)
  }

  async importAttachments(
    files: ReadonlyArray<{ name: string; mimeType: string; dataBase64: string }>,
    at: number
  ): Promise<AttachmentRef[]> {
    const attachmentsDir = this.paths.attachmentsDir(this.path)
    await ensureDir(attachmentsDir)

    const results: AttachmentRef[] = []
    for (const file of files) {
      const id = randomUUID()
      const fileName = `${id}-${sanitizeFileName(file.name)}`
      const buffer = Buffer.from(file.dataBase64, 'base64')
      await writeBinaryAtomic(join(attachmentsDir, fileName), buffer)

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
    const target = this.resolveAttachmentPath(relativePath)
    await removePath(target)
  }

  /** 读取附件并编码为 data URL，供模型请求内联图片 */
  async readAttachmentAsDataUrl(attachment: AttachmentRef): Promise<string | null> {
    const buffer = await readBinary(this.resolveAttachmentPath(attachment.relativePath))
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
    const conversation = await this.readConversation(pageId)

    const next = replacePageMetadata(text, {
      version: PAGE_FILE_FORMAT_VERSION,
      page,
      topics: conversation.topics,
      leafMessageId: conversation.leafMessageId,
      selectedMessageId: conversation.selectedMessageId
    })

    await writeTextAtomic(absolutePath, next)

    const mtime = (await mtimeOf(absolutePath)) ?? Date.now()
    this.pageMtimes.set(pageId, mtime)
    this.conversationCache.set(pageId, { mtime, conversation })
    this.index.upsertPage(page, relativePath, mtime)
  }

  /**
   * 计算并应用新建节点的位置
   *
   * 与迁移前的 prepareInsertPosition 对齐：
   * - 有参照项（afterNodeId）→ 插到该同级节点之后，后续同级整体下移
   * - 只给了父文件夹 → 追加到该文件夹末尾
   * - 都没有 → 插到根目录最前面（旧实现在无参照时 order = 0 并下移同级）
   */
  private async applyInsertPosition(
    nodeId: string,
    afterNodeId: string | undefined,
    parentFolderId: string | undefined,
    at: number
  ): Promise<void> {
    if (!afterNodeId && parentFolderId) return

    const tree = this.getTree()
    const node =
      tree.pages.find((item) => item.id === nodeId) ??
      tree.folders.find((item) => item.id === nodeId)
    if (!node) return

    const siblings = childrenOf(tree, node.parentFolderId).filter((item) => item.id !== nodeId)

    if (!afterNodeId) {
      // 插到最前面
      const moved = moveNode(tree, nodeId, node.parentFolderId, siblings[0]?.id, at)
      this.folders = moved.folders
      this.pages = moved.pages
      return
    }

    const referenceIndex = siblings.findIndex((item) => item.id === afterNodeId)
    if (referenceIndex === -1) return

    const nextSibling = siblings[referenceIndex + 1]
    const moved = moveNode(tree, nodeId, node.parentFolderId, nextSibling?.id, at)
    this.folders = moved.folders
    this.pages = moved.pages
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

  /**
   * 一次性迁移：早期版本把页面统一放在 pages/ 子目录下，
   * 新布局要求页面直接位于工作区根目录（目录即文件夹）。
   */
  private async migrateLegacyPagesDirectory(): Promise<void> {
    const legacyDir = join(this.path, 'pages')
    if (!(await isDirectory(legacyDir))) return
    if (this.folders.some((folder) => folder.name === 'pages')) return

    const files = await walkFiles(legacyDir, {
      include: isPageFileName,
      skipDirectory: () => false
    })
    for (const file of files) {
      const relative = file.relativePath
      const target = join(this.path, relative)
      if (await pathExists(target)) continue
      await movePath(file.absolutePath, target)
    }

    await removePath(legacyDir, true)
  }

  private async persistFolders(): Promise<void> {
    await writeJsonAtomic(this.paths.foldersFile(this.path), {
      folders: this.folders
    } satisfies FoldersFile)
  }

  /** 扫描磁盘；返回页面结构是否发生变化 */
  private async scanFromDisk(): Promise<boolean> {
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
      if (pagePaths.has(parsed.value.page.id)) continue

      pages.push({ ...parsed.value.page, parentFolderId: folderId })
      pagePaths.set(parsed.value.page.id, file.relativePath)
      pageMtimes.set(parsed.value.page.id, file.modifiedAt)
    }

    const knownIds = new Set(this.pages.map((page) => page.id))
    const nextIds = new Set(pages.map((page) => page.id))
    const structureChanged =
      knownIds.size !== nextIds.size || [...nextIds].some((id) => !knownIds.has(id))

    this.pages = pages
    this.pagePaths = pagePaths
    this.pageMtimes = pageMtimes

    if (foldersChanged) await this.persistFolders()
    await this.removeOrphanFolders()

    const diagnostics = validatePageTree(this.getTree())
    if (diagnostics.length > 0) {
      console.warn('[runtime] 页面树存在异常：', diagnostics.slice(0, 5))
    }

    return structureChanged
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
    this.folderDirs = layout.folderDirs

    for (const dir of new Set(layout.folderDirs.values())) {
      await ensureDir(this.absPath(dir))
    }

    let pending = this.pages.filter((page) => {
      const desired = layout.pagePaths.get(page.id)
      return desired !== undefined && this.pagePaths.get(page.id) !== desired
    })

    // 目标位置可能被另一个待移动的页面占用，多轮尝试直到收敛
    for (let pass = 0; pass < 3 && pending.length > 0; pass++) {
      const remaining: Page[] = []

      for (const page of pending) {
        const desired = layout.pagePaths.get(page.id)
        if (!desired) continue

        const toAbs = this.absPath(desired)
        if (await pathExists(toAbs)) {
          remaining.push(page)
          continue
        }

        const from = this.pagePaths.get(page.id)
        if (from) {
          const fromAbs = this.absPath(from)
          if (await pathExists(fromAbs)) await movePath(fromAbs, toAbs)
        }
        this.pagePaths.set(page.id, desired)
      }

      pending = remaining
    }

    await this.pruneEmptyDirectories(new Set(layout.folderDirs.values()))
  }

  private async pruneEmptyDirectories(keep: ReadonlySet<string>): Promise<void> {
    const directories = await this.collectDirectories('')
    directories.sort((a, b) => b.split('/').length - a.split('/').length)

    for (const dir of directories) {
      if (keep.has(dir)) continue
      const absolute = this.absPath(dir)
      const files = await walkFiles(absolute)
      const subdirs = await listDirectories(absolute)
      if (files.length === 0 && subdirs.length === 0) {
        await removePath(absolute, true)
      }
    }
  }

  private async collectDirectories(parentDir: string): Promise<string[]> {
    const absolute = parentDir ? this.absPath(parentDir) : this.path
    const names = await listDirectories(absolute)
    const result: string[] = []

    for (const name of names) {
      if (name.startsWith('.')) continue
      const dir = parentDir ? `${parentDir}/${name}` : name
      result.push(dir, ...(await this.collectDirectories(dir)))
    }

    return result
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

    const mtime = this.pageMtimes.get(pageId) ?? Date.now()
    this.index.upsertPage(page, relativePath, mtime)
    this.index.replaceMessages(pageId, conversation.messages)
  }

  /** 文件被外部修改后，用文件内的元数据刷新内存中的页面信息 */
  private refreshPageFromDocument(pageId: string, parsedPage: Page): void {
    const current = this.pages.find((page) => page.id === pageId)
    if (!current) return

    const next: Page = {
      ...current,
      name: parsedPage.name || current.name,
      starred: parsedPage.starred ?? current.starred,
      order: parsedPage.order,
      updatedAt: parsedPage.updatedAt
    }

    const unchanged =
      next.name === current.name && next.starred === current.starred && next.order === current.order
    if (!unchanged) {
      this.pages = this.pages.map((page) => (page.id === pageId ? next : page))
    }
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

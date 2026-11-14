/**
 * 工作区检索
 *
 * 索引只用于缩小候选范围，精确匹配（大小写、整词、正则）由领域层匹配器完成，
 * 因此界面上的高亮与命中位置始终与用户输入一致。
 */

import type { Folder, PageTree, SearchMatch, SearchOptions, SearchPageInfo } from '@shared/domain'
import {
  buildSnippet,
  DEFAULT_SEARCH_OPTIONS,
  descendantFolderIds,
  groupMatches,
  withinTimeRange
} from '@shared/domain'
import type {
  MessageSearchMatch,
  MessageSearchRequest,
  WorkspaceSearchResult
} from '@shared/contracts'
import { SearchExecutor } from './SearchExecutor'
import type { IndexDb } from './IndexDb'
import type { WorkspaceStore } from './WorkspaceStore'

const FTS_MIN_QUERY_LENGTH = 3

export class SearchService {
  private readonly executor = new SearchExecutor()

  constructor(
    private readonly index: IndexDb,
    private readonly workspace: WorkspaceStore
  ) {}

  async search(query: string, options: SearchOptions): Promise<WorkspaceSearchResult> {
    const trimmed = query.trim()
    if (!trimmed) return { groups: [], total: 0 }

    // 只在读取快照时占用工作区队列；慢正则不阻塞消息保存和后续查询。
    const { candidates, pageInfo } = await this.workspace.read(() => {
      const now = Date.now()
      const tree = this.workspace.getTree()
      const folders = new Map(tree.folders.map((folder) => [folder.id, folder]))
      const labels = new Map<string, string | undefined>()
      const allowedPages = this.resolveFolderFilter(tree, options.folderIds)
      const useFts = [...trimmed].length >= FTS_MIN_QUERY_LENGTH
      // SQLite LIKE 的大小写折叠仅覆盖 ASCII，短查询交给同一 Unicode 匹配器。
      const indexed =
        options.useRegex || (!useFts && !options.matchCase)
          ? this.index.allMessages()
          : this.index.searchCandidates(trimmed, useFts)
      const candidates = indexed.filter(
        (candidate) =>
          (!allowedPages || allowedPages.has(candidate.pageId)) &&
          (options.roleFilter === 'all' || candidate.role === options.roleFilter) &&
          withinTimeRange(candidate.createdAt, options.timeRange, now)
      )
      const pageInfo = new Map<string, SearchPageInfo>()
      for (const page of tree.pages) {
        if (page.parentFolderId && !labels.has(page.parentFolderId))
          labels.set(page.parentFolderId, this.folderPathLabel(folders, page.parentFolderId))
        pageInfo.set(page.id, {
          title: page.name,
          createdAt: page.createdAt,
          folderPath: page.parentFolderId ? labels.get(page.parentFolderId) : undefined
        })
      }
      return { candidates, pageInfo }
    })
    const found = await this.executor.run(
      candidates.map((candidate) => candidate.content),
      trimmed,
      options
    )

    const matches: SearchMatch[] = []

    for (const { index, ranges } of found) {
      const candidate = candidates[index]
      ranges.forEach((range, occurrence) => {
        const snippet = buildSnippet(candidate.content, range)
        matches.push({
          pageId: candidate.pageId,
          messageId: candidate.messageId,
          role: candidate.role,
          snippet: snippet.snippet,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
          contentStart: snippet.contentStart,
          contentEnd: snippet.contentEnd,
          occurrenceIndexInMessage: occurrence,
          createdAt: candidate.createdAt
        })
      })
    }

    return { groups: groupMatches(matches, pageInfo), total: matches.length }
  }

  async messages(input: MessageSearchRequest): Promise<MessageSearchMatch[]> {
    const found = await this.executor.run(
      input.messages.map((message) => message.content),
      input.query,
      {
        ...DEFAULT_SEARCH_OPTIONS,
        ...input.options
      }
    )
    const matches: MessageSearchMatch[] = []
    for (const { index, ranges } of found) {
      for (const range of ranges) {
        matches.push({
          messageId: input.messages[index].id,
          startOffset: range.start,
          endOffset: range.end,
          globalIndex: matches.length
        })
      }
    }
    return matches
  }

  dispose(): Promise<void> {
    return this.executor.dispose()
  }

  /** 将文件夹筛选展开为页面 id 集合；未指定时返回 null 表示不筛选 */
  private resolveFolderFilter(tree: PageTree, folderIds?: readonly string[]): Set<string> | null {
    if (!folderIds || folderIds.length === 0) return null

    const folderSet = new Set<string>()
    for (const folderId of folderIds) {
      folderSet.add(folderId)
      for (const descendant of descendantFolderIds(tree, folderId)) folderSet.add(descendant)
    }

    const pageIds = new Set<string>()
    for (const page of tree.pages) {
      if (page.parentFolderId && folderSet.has(page.parentFolderId)) pageIds.add(page.id)
    }

    return pageIds
  }

  private folderPathLabel(
    folders: ReadonlyMap<string, Folder>,
    folderId: string
  ): string | undefined {
    if (!folderId) return undefined

    const names: string[] = []
    const visited = new Set<string>()
    let currentId: string | undefined = folderId

    while (currentId) {
      if (visited.has(currentId)) break
      visited.add(currentId)
      const folder = folders.get(currentId)
      if (!folder) break
      names.push(folder.name)
      currentId = folder.parentFolderId
    }

    return names.length > 0 ? names.reverse().join(' / ') : undefined
  }
}

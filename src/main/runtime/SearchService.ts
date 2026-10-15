/**
 * 工作区检索
 *
 * 索引只用于缩小候选范围，精确匹配（大小写、整词、正则）由领域层匹配器完成，
 * 因此界面上的高亮与命中位置始终与用户输入一致。
 */

import type { SearchMatch, SearchOptions, SearchPageInfo } from '@shared/domain'
import {
  buildSnippet,
  compileMatcher,
  descendantFolderIds,
  groupMatches,
  withinTimeRange
} from '@shared/domain'
import type { WorkspaceSearchResult } from '@shared/contracts'
import type { IndexDb } from './IndexDb'
import type { WorkspaceStore } from './WorkspaceStore'

const FTS_MIN_QUERY_LENGTH = 3

export class SearchService {
  constructor(
    private readonly index: IndexDb,
    private readonly workspace: WorkspaceStore
  ) {}

  search(query: string, options: SearchOptions): WorkspaceSearchResult {
    const trimmed = query.trim()
    if (!trimmed) return { groups: [], total: 0 }

    const matcher = compileMatcher(trimmed, options)
    const now = Date.now()
    const allowedPages = this.resolveFolderFilter(options.folderIds)

    const candidates = options.useRegex
      ? this.index.allMessages()
      : this.index.searchCandidates(trimmed, trimmed.length >= FTS_MIN_QUERY_LENGTH)

    const matches: SearchMatch[] = []

    for (const candidate of candidates) {
      if (allowedPages && !allowedPages.has(candidate.pageId)) continue
      if (options.roleFilter !== 'all' && candidate.role !== options.roleFilter) continue
      if (!withinTimeRange(candidate.createdAt, options.timeRange, now)) continue

      const ranges = matcher(candidate.content)
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

    const pageInfo = new Map<string, SearchPageInfo>()
    for (const pageId of new Set(matches.map((match) => match.pageId))) {
      const page = this.workspace.getPage(pageId)
      if (!page) continue
      pageInfo.set(pageId, {
        title: page.name,
        createdAt: page.createdAt,
        folderPath: this.folderPathLabel(page.parentFolderId)
      })
    }

    return { groups: groupMatches(matches, pageInfo), total: matches.length }
  }

  /** 将文件夹筛选展开为页面 id 集合；未指定时返回 null 表示不筛选 */
  private resolveFolderFilter(folderIds?: readonly string[]): Set<string> | null {
    if (!folderIds || folderIds.length === 0) return null

    const tree = this.workspace.getTree()
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

  private folderPathLabel(folderId?: string): string | undefined {
    if (!folderId) return undefined

    const tree = this.workspace.getTree()
    const names: string[] = []
    const visited = new Set<string>()
    let currentId: string | undefined = folderId

    while (currentId) {
      if (visited.has(currentId)) break
      visited.add(currentId)
      const folder = tree.folders.find((item) => item.id === currentId)
      if (!folder) break
      names.unshift(folder.name)
      currentId = folder.parentFolderId
    }

    return names.length > 0 ? names.join(' / ') : undefined
  }
}

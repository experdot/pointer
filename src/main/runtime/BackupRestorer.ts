/** 备份恢复的顺序、冲突和引用映射统一由内核处理。失败即停止并返回已完成计数。 */
import { randomUUID } from 'node:crypto'
import type {
  ConfigFolder,
  ConfigItemBase,
  ConfigTree,
  Conversation,
  TreeNodeBase
} from '@shared/domain'
import {
  emptyConversation,
  compareNodes,
  childrenOf,
  isOrderKey,
  orderKeysBetween,
  isReservedDirectory,
  nameKey,
  sanitizeFileName,
  uniqueName,
  validateConversation
} from '@shared/domain'
import {
  BACKUP_FORMAT_VERSION,
  RuntimeError,
  type BackupRestoreInput,
  type BackupRestoreResult
} from '@shared/contracts'
import type { WorkspaceStore } from './WorkspaceStore'
import type { SettingsStore } from './SettingsStore'
import type { ViewStateStore } from './ViewStateStore'
import { assertSafeId } from './pathSafety'

type Node = TreeNodeBase

function selected<T extends Node>(all: T[] | undefined, ids: string[]): T[] {
  if (!Array.isArray(ids) || (all !== undefined && !Array.isArray(all)))
    throw new RuntimeError('backup.invalid', '备份列表格式错误')
  const nodes = all ?? []
  const seen = new Set<string>()
  for (const node of nodes) {
    assertSafeId(node.id)
    if (seen.has(node.id) || typeof node.name !== 'string' || !isOrderKey(node.orderKey))
      throw new RuntimeError('backup.invalid', '备份中存在重复标识或无效名称')
    seen.add(node.id)
  }
  for (const id of ids)
    if (!seen.has(id))
      throw new RuntimeError('backup.missing-selection', `备份中找不到选中对象：${id}`)
  return nodes.filter((node) => ids.includes(node.id)).sort(compareNodes)
}

function parentsFirst<T extends Node>(nodes: T[]): T[] {
  const result: T[] = []
  const remaining = new Map(nodes.map((node) => [node.id, node]))
  while (remaining.size) {
    const ready = [...remaining.values()].filter(
      (node) => !node.parentFolderId || !remaining.has(node.parentFolderId)
    )
    if (!ready.length) throw new RuntimeError('backup.folder-cycle', '备份文件夹引用形成循环')
    for (const node of ready) {
      result.push(node)
      remaining.delete(node.id)
    }
  }
  return result
}

export async function restoreBackup(
  workspace: WorkspaceStore,
  settingsStore: SettingsStore,
  viewStore: ViewStateStore,
  input: BackupRestoreInput
): Promise<BackupRestoreResult> {
  if (
    input.backup?.version !== BACKUP_FORMAT_VERSION ||
    !input.backup.data ||
    !['generate-new', 'skip', 'overwrite'].includes(input.strategy)
  )
    throw new RuntimeError('backup.invalid', '备份格式或冲突策略无效')
  const { data } = input.backup
  const { selection, strategy } = input
  const folders = parentsFirst(selected(data.folders, selection.folders))
  const pages = selected(data.pages, selection.pages)
  const llmFolders = parentsFirst(
    selected(data.settings?.llmConfigs?.folders, selection.llmFolders)
  )
  const modelFolders = parentsFirst(
    selected(data.settings?.modelConfigs?.folders, selection.modelFolders)
  )
  const llm = selected(data.settings?.llmConfigs?.items, selection.llm)
  const models = selected(data.settings?.modelConfigs?.items, selection.models)
  for (const nodes of [
    [...folders, ...pages],
    [...llmFolders, ...llm],
    [...modelFolders, ...models]
  ]) {
    if (new Set(nodes.map((node) => node.id)).size !== nodes.length)
      throw new RuntimeError('backup.invalid', '同一棵树包含重复标识')
  }
  const records = new Map<string, Conversation>()
  for (const folder of folders)
    if (isReservedDirectory(sanitizeFileName(folder.name)))
      throw new RuntimeError('folder.reserved-name', '备份包含系统保留目录')
  for (const record of data.messages ?? []) {
    if (!selection.pages.includes(record.pageId)) continue
    if (records.has(record.pageId)) throw new RuntimeError('backup.invalid', '备份包含重复会话')
    const conversation = { ...record, topics: record.topics ?? [] }
    const diagnostics = validateConversation(conversation)
    if (diagnostics.length)
      throw new RuntimeError('backup.invalid-reference', '会话引用无效', diagnostics)
    for (const message of conversation.messages) {
      for (const attachment of message.attachments ?? [])
        workspace.resolveAttachmentPath(attachment.relativePath)
    }
    records.set(record.pageId, conversation)
  }
  if (
    selection.ui &&
    data.viewState &&
    (!Array.isArray(data.viewState.tabs) ||
      !Array.isArray(data.viewState.history) ||
      !data.viewState.layout)
  )
    throw new RuntimeError('backup.invalid', '界面状态格式错误')

  const map = (): Record<string, string> => Object.create(null) as Record<string, string>
  const result: BackupRestoreResult = {
    counts: { pages: 0, folders: 0, messages: 0, configs: 0, configFolders: 0, skipped: 0 },
    ids: {
      pages: map(),
      folders: map(),
      llm: map(),
      llmFolders: map(),
      models: map(),
      modelFolders: map()
    },
    warnings: []
  }
  const parent = (
    id: string | undefined,
    ids: Record<string, string>,
    exists: (id: string) => boolean
  ): string | undefined => {
    if (!id) return undefined
    if (ids[id]) return ids[id]
    if (exists(id)) return id
    result.warnings.push(`父文件夹 ${id} 未选中且本地不存在，已提升至根目录`)
    return undefined
  }
  const mergeConfigs = <T extends ConfigItemBase>(
    tree: ConfigTree<T>,
    incomingFolders: ConfigFolder[],
    items: T[],
    folderIds: Record<string, string>,
    itemIds: Record<string, string>
  ): ConfigTree<T> => {
    const next = { folders: [...tree.folders], items: [...tree.items] }
    // 先建立完整映射，未选择的父目录提升到根时也共用同一个键空间。
    for (const folder of incomingFolders)
      folderIds[folder.id] =
        (strategy === 'generate-new' && next.folders.some((n) => n.id === folder.id)) ||
        next.items.some((n) => n.id === folder.id)
          ? randomUUID()
          : folder.id
    const changed: (T | ConfigFolder)[] = []
    const merge = <N extends T | ConfigFolder>(
      nodes: N[],
      node: N,
      ids: Record<string, string>
    ): void => {
      const existing = nodes.find((item) => item.id === node.id)
      const otherKind = node.kind === 'folder' ? next.items : next.folders
      const id =
        ids[node.id] ??
        ((existing && strategy === 'generate-new') || otherKind.some((n) => n.id === node.id)
          ? randomUUID()
          : node.id)
      ids[node.id] = id
      if (existing && strategy === 'skip') {
        result.counts.skipped++
        return
      }
      const parentFolderId = parent(node.parentFolderId, folderIds, (id) =>
        next.folders.some((folder) => folder.id === id)
      )
      const taken = new Set(
        [...next.folders, ...next.items]
          .filter((item) => item.id !== id && item.parentFolderId === parentFolderId)
          .map((item) => nameKey(item.name))
      )
      const keepKey =
        existing && strategy === 'overwrite' && existing.parentFolderId === parentFolderId
      const value = {
        ...node,
        id,
        parentFolderId,
        orderKey: keepKey ? existing.orderKey : node.orderKey,
        name: uniqueName(taken, node.name)
      }
      const index = nodes.findIndex((item) => item.id === id)
      if (index >= 0) nodes[index] = value
      else nodes.push(value)
      if (!keepKey) changed.push(value)
    }
    for (const folder of incomingFolders) merge(next.folders, folder, folderIds)
    for (const item of items) merge(next.items, item, itemIds)
    const changedIds = new Set(changed.map((node) => node.id))
    const groups = new Map<string | undefined, (T | ConfigFolder)[]>()
    for (const node of changed.sort(compareNodes)) {
      const group = groups.get(node.parentFolderId) ?? []
      group.push(node)
      groups.set(node.parentFolderId, group)
    }
    for (const [parentId, group] of groups) {
      const existing = [...next.folders, ...next.items]
        .filter((node) => node.parentFolderId === parentId && !changedIds.has(node.id))
        .sort(compareNodes)
      const keys = orderKeysBetween(existing.at(-1)?.orderKey ?? null, null, group.length)
      group.forEach((node, index) => {
        node.orderKey = keys[index]
      })
    }
    return next
  }
  try {
    if (llmFolders.length || modelFolders.length || llm.length || models.length) {
      const settings = settingsStore.get()
      const next = {
        ...settings,
        llmConfigs: mergeConfigs(
          settings.llmConfigs,
          llmFolders,
          llm,
          result.ids.llmFolders,
          result.ids.llm
        ),
        modelConfigs: mergeConfigs(
          settings.modelConfigs,
          modelFolders,
          models,
          result.ids.modelFolders,
          result.ids.models
        )
      }
      const defaultLLM = data.settings?.defaultLLMId
      const defaultModel = data.settings?.defaultModelConfigId
      if (defaultLLM && result.ids.llm[defaultLLM]) next.defaultLLMId = result.ids.llm[defaultLLM]
      if (defaultModel && result.ids.models[defaultModel])
        next.defaultModelConfigId = result.ids.models[defaultModel]
      try {
        await settingsStore.replace(next)
      } catch (error) {
        result.ids.llm = map()
        result.ids.models = map()
        result.ids.llmFolders = map()
        result.ids.modelFolders = map()
        throw error
      }
      result.counts.configs =
        llm.filter(
          (item) =>
            !(strategy === 'skip' && settings.llmConfigs.items.some((old) => old.id === item.id))
        ).length +
        models.filter(
          (item) =>
            !(strategy === 'skip' && settings.modelConfigs.items.some((old) => old.id === item.id))
        ).length
      result.counts.configFolders =
        llmFolders.filter(
          (item) =>
            !(strategy === 'skip' && settings.llmConfigs.folders.some((old) => old.id === item.id))
        ).length +
        modelFolders.filter(
          (item) =>
            !(
              strategy === 'skip' && settings.modelConfigs.folders.some((old) => old.id === item.id)
            )
        ).length
    }
    const plannedFolderIds = map()
    for (const folder of folders) {
      const existing = workspace.getFolder(folder.id)
      plannedFolderIds[folder.id] =
        (existing && strategy === 'generate-new') || workspace.getPage(folder.id)
          ? randomUUID()
          : folder.id
    }
    const placements = new Map<string, { parentFolderId?: string; orderKey: string }>()
    const groups = new Map<string | undefined, { head: Node[]; tail: Node[] }>()
    for (const node of [...folders, ...pages].sort(compareNodes)) {
      const existing =
        node.kind === 'folder' ? workspace.getFolder(node.id) : workspace.getPage(node.id)
      if (existing && strategy === 'skip') continue
      const parentFolderId = parent(node.parentFolderId, plannedFolderIds, (id) =>
        Boolean(workspace.getFolder(id))
      )
      const group = groups.get(parentFolderId) ?? { head: [], tail: [] }
      const append = existing && strategy === 'overwrite'
      group[append ? 'tail' : 'head'].push(node)
      groups.set(parentFolderId, group)
    }
    for (const [parentFolderId, group] of groups) {
      const siblings = childrenOf(workspace.getTree(), parentFolderId)
      // 页面批量恢复置顶；纯子文件夹批量恢复沿用追加，混合批次保持导出次序。
      if (parentFolderId && group.head.every((node) => 'kind' in node && node.kind === 'folder')) {
        group.tail = [...group.head, ...group.tail].sort(compareNodes)
        group.head = []
      }
      const head = orderKeysBetween(null, siblings[0]?.orderKey ?? null, group.head.length)
      const tail = orderKeysBetween(
        siblings.at(-1)?.orderKey ?? head.at(-1) ?? null,
        null,
        group.tail.length
      )
      for (const [nodes, keys] of [
        [group.head, head],
        [group.tail, tail]
      ] as const)
        nodes.forEach((node, index) =>
          placements.set(node.id, { parentFolderId, orderKey: keys[index] })
        )
    }
    for (const folder of folders) {
      const existing = workspace.getFolder(folder.id)
      if (existing && strategy === 'skip') {
        result.ids.folders[folder.id] = existing.id
        result.counts.skipped++
        continue
      }
      const { parentFolderId, orderKey } = placements.get(folder.id)!
      const restoredId = await workspace.write(async () => {
        if (existing && strategy === 'overwrite') {
          await workspace.moveTreeNode(
            {
              nodeId: existing.id,
              targetNodeId: parentFolderId,
              placement: 'end',
              conflictPolicy: 'rename'
            },
            Date.now(),
            orderKey
          )
          await workspace.updateFolder(existing.id, { name: folder.name }, Date.now())
          return existing.id
        } else {
          const created = await workspace.createFolder(
            {
              id: plannedFolderIds[folder.id],
              name: folder.name,
              parentFolderId
            },
            folder.createdAt,
            orderKey
          )
          return created.id
        }
      })
      result.ids.folders[folder.id] = restoredId
      result.counts.folders++
    }
    for (const page of pages) {
      const existing = workspace.getPage(page.id)
      if (existing && strategy === 'skip') {
        result.ids.pages[page.id] = existing.id
        result.counts.skipped++
        continue
      }
      const { parentFolderId, orderKey } = placements.get(page.id)!
      const restoredId = await workspace.write(async () => {
        let id: string
        if (existing && strategy === 'overwrite') {
          id = existing.id
          await workspace.moveTreeNode(
            {
              nodeId: id,
              targetNodeId: parentFolderId,
              placement: 'end',
              conflictPolicy: 'rename'
            },
            Date.now(),
            orderKey
          )
          await workspace.updatePage(
            id,
            { name: page.name, starred: page.starred ?? false },
            Date.now()
          )
        } else {
          id = (
            await workspace.createPage(
              {
                id: existing || workspace.getFolder(page.id) ? undefined : page.id,
                name: page.name,
                starred: page.starred,
                parentFolderId
              },
              page.createdAt,
              orderKey
            )
          ).id
        }
        const record = records.get(page.id) ?? emptyConversation(id)
        await workspace.writeConversation({
          ...record,
          pageId: id,
          messages: record.messages.map((message) => ({
            ...message,
            llmId: message.llmId ? (result.ids.llm[message.llmId] ?? message.llmId) : undefined,
            modelConfigId: message.modelConfigId
              ? (result.ids.models[message.modelConfigId] ?? message.modelConfigId)
              : undefined
          }))
        })
        return id
      })
      result.ids.pages[page.id] = restoredId
      result.counts.pages++
      result.counts.messages += records.get(page.id)?.messages.length ?? 0
    }
    if (selection.ui && data.viewState) {
      const old = viewStore.get()
      const incoming = data.viewState
      const tabIds = map()
      const tabs = [...old.tabs]
      for (const tab of incoming.tabs) {
        const dataId =
          tab.type === 'chat' && tab.dataId
            ? (result.ids.pages[tab.dataId] ??
              (workspace.getPage(tab.dataId) ? tab.dataId : undefined))
            : tab.dataId
        if (tab.type === 'chat' && !dataId) {
          result.warnings.push(`标签页 ${tab.title} 引用的对话不存在，已忽略`)
          continue
        }
        const index = tabs.findIndex((item) => item.id === tab.id)
        const id = index >= 0 && strategy === 'generate-new' ? randomUUID() : tab.id
        tabIds[tab.id] = id
        if (index >= 0 && strategy === 'skip') continue
        const value = { ...tab, id, dataId }
        if (index >= 0 && strategy === 'overwrite') tabs[index] = value
        else tabs.push(value)
      }
      const history = incoming.history.flatMap((entry) =>
        tabIds[entry.tabId]
          ? [
              {
                ...entry,
                tabId: tabIds[entry.tabId],
                dataId:
                  entry.type === 'chat' && entry.dataId
                    ? (result.ids.pages[entry.dataId] ?? entry.dataId)
                    : entry.dataId
              }
            ]
          : []
      )
      await viewStore.replace({
        ...old,
        ...incoming,
        tabs,
        activeTabId: incoming.activeTabId
          ? (tabIds[incoming.activeTabId] ?? old.activeTabId)
          : null,
        history,
        historyIndex: Math.min(incoming.historyIndex, history.length - 1),
        expandedFolderIds: (incoming.expandedFolderIds ?? []).flatMap((id) =>
          result.ids.folders[id] ? [result.ids.folders[id]] : workspace.getFolder(id) ? [id] : []
        ),
        expandedConfigFolderIds: (incoming.expandedConfigFolderIds ?? []).map(
          (id) => result.ids.llmFolders[id] ?? result.ids.modelFolders[id] ?? id
        )
      })
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
  }
  return result
}

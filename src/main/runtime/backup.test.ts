import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { RuntimeCore, type RuntimeHost } from './RuntimeCore'
import type { WorkspaceStore } from './WorkspaceStore'
import {
  defaultViewState,
  type BackupData,
  type BackupRestoreInput,
  type BackupRestoreResult,
  type SettingsSnapshot
} from '@shared/contracts'
import { childrenOf, validateOrderKeys, type Conversation, type PageTree } from '@shared/domain'

const host: RuntimeHost = {
  getVersion: () => 'test',
  saveFile: async () => ({}),
  openTextFile: async () => null,
  pickDirectory: async () => null,
  pickImages: async () => [],
  openInFileManager: async () => undefined
}
let runtime: RuntimeCore
let root: string
const backup = (): BackupData => ({
  version: '2.0.0',
  exportedAt: 1,
  data: {
    folders: [
      {
        id: 'child',
        kind: 'folder',
        name: 'child',
        parentFolderId: 'parent',
        orderKey: 'a0',
        createdAt: 1
      },
      { id: 'parent', kind: 'folder', name: 'parent', orderKey: 'a0', createdAt: 1 }
    ],
    pages: [
      {
        id: 'page',
        kind: 'page',
        name: 'restored',
        parentFolderId: 'child',
        orderKey: 'a0',
        createdAt: 1
      }
    ],
    messages: [
      {
        pageId: 'page',
        messages: [
          {
            id: 'user',
            role: 'user',
            content: 'question',
            branchIndex: 0,
            createdAt: 1,
            attachments: [
              {
                id: 'missing',
                name: 'missing.png',
                mimeType: 'image/png',
                size: 10,
                createdAt: 1,
                relativePath: '.pointer/attachments/missing.png'
              }
            ]
          },
          {
            id: 'answer',
            role: 'assistant',
            content: 'answer',
            parentMessageId: 'user',
            branchIndex: 0,
            createdAt: 2,
            llmId: 'llm'
          },
          {
            id: 'branch',
            role: 'assistant',
            content: 'alternative',
            parentMessageId: 'user',
            branchIndex: 1,
            createdAt: 3
          }
        ],
        topics: [
          {
            id: 'topic',
            name: 'topic',
            startMessageId: 'user',
            endMessageId: 'answer',
            collapsed: true
          }
        ],
        leafMessageId: 'answer',
        selectedMessageId: 'user'
      }
    ],
    settings: {
      llmConfigs: {
        folders: [
          {
            id: 'lc',
            kind: 'folder',
            name: 'child',
            parentFolderId: 'lp',
            orderKey: 'a0',
            createdAt: 1
          },
          { id: 'lp', kind: 'folder', name: 'parent', orderKey: 'a0', createdAt: 1 }
        ],
        items: [
          {
            id: 'llm',
            kind: 'item',
            name: 'LLM',
            parentFolderId: 'lc',
            orderKey: 'a0',
            createdAt: 1,
            apiKey: '',
            baseUrl: '',
            modelName: ''
          }
        ]
      },
      defaultLLMId: 'llm'
    },
    viewState: {
      ...defaultViewState(),
      tabs: [{ id: 'tab', title: 'restored', type: 'chat', dataId: 'page' }],
      activeTabId: 'tab',
      history: [{ tabId: 'tab', type: 'chat', dataId: 'page' }],
      historyIndex: 0,
      expandedFolderIds: ['parent', 'child']
    }
  }
})
const input = (
  data = backup(),
  strategy: BackupRestoreInput['strategy'] = 'generate-new'
): BackupRestoreInput => ({
  backup: data,
  strategy,
  selection: {
    pages: data.data.pages?.map((item) => item.id) ?? [],
    folders: data.data.folders?.map((item) => item.id) ?? [],
    llm: data.data.settings?.llmConfigs?.items.map((item) => item.id) ?? [],
    llmFolders: data.data.settings?.llmConfigs?.folders.map((item) => item.id) ?? [],
    models: [],
    modelFolders: [],
    ui: true
  }
})
const restore = async (value: BackupRestoreInput): Promise<BackupRestoreResult> =>
  (await runtime.command('backup.restore', value)) as BackupRestoreResult

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pointer-backup-'))
  runtime = new RuntimeCore({ appDataPath: root, host })
  await runtime.init()
})
afterEach(async () => {
  vi.restoreAllMocks()
  await runtime.dispose()
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('pointer-backup-'))
    throw new Error('非法清理目录')
  await rm(root, { force: true, recursive: true })
})

describe('[R21] 内核备份恢复', () => {
  it('只接受 2.0.0 备份和有效的字符串键', async () => {
    for (const version of ['1.0', '1.0.0', '3.0.0'])
      await expect(restore(input({ ...backup(), version }))).rejects.toMatchObject({
        code: 'backup.invalid'
      })
    const invalid = backup()
    invalid.data.pages![0].orderKey = ''
    await expect(restore(input(invalid))).rejects.toMatchObject({ code: 'backup.invalid' })
    expect(await runtime.query('tree.get', undefined)).toEqual({ pages: [], folders: [] })
  })

  it.each(['generate-new', 'skip', 'overwrite'] as const)(
    '不同节点类型占用 ID 时 %s 策略不覆盖既有节点',
    async (strategy) => {
      const created = await runtime.command('page.create', { name: 'existing' })
      const value = backup()
      value.data = {
        folders: [
          { id: created.id, name: 'restored', kind: 'folder', orderKey: 'a0', createdAt: 1 }
        ]
      }
      const result = await restore(input(value, strategy))
      expect(result.error).toBeUndefined()
      expect(result.ids.folders[created.id]).not.toBe(created.id)
      const tree = (await runtime.query('tree.get', undefined)) as PageTree
      expect(tree.pages).toEqual([created])
      expect(tree.folders).toHaveLength(1)
      const settings = ((await runtime.query('settings.get', undefined)) as SettingsSnapshot)
        .settings
      settings.llmConfigs.folders = [
        {
          id: 'config-collision',
          name: 'existing-config-folder',
          kind: 'folder',
          createdAt: 1,
          orderKey: 'a0'
        }
      ]
      await runtime.command('settings.replace', { settings })
      const configBackup = backup()
      const config = configBackup.data.settings!.llmConfigs!.items[0]
      configBackup.data = {
        settings: { llmConfigs: { folders: [], items: [{ ...config, id: 'config-collision' }] } }
      }
      const configs = await restore(input(configBackup, strategy))
      expect(configs.error).toBeUndefined()
      expect(configs.ids.llm['config-collision']).not.toBe('config-collision')
      const configTree = ((await runtime.query('settings.get', undefined)) as SettingsSnapshot)
        .settings.llmConfigs
      expect(configTree.folders).toEqual(settings.llmConfigs.folders)
      expect(validateOrderKeys([...configTree.folders, ...configTree.items])).toEqual([])
      const duplicate = backup()
      duplicate.data.pages![0].id = duplicate.data.folders![0].id
      await expect(restore(input(duplicate))).rejects.toMatchObject({ code: 'backup.invalid' })
    }
  )

  it('混合树批量恢复保持同层级相对顺序，往返不修改既有节点的键', async () => {
    const data = backup()
    data.data.settings = undefined
    data.data.viewState = undefined
    data.data.folders = [
      { id: 'root', kind: 'folder', name: 'root', orderKey: 'a0', createdAt: 1 },
      {
        id: 'nested',
        kind: 'folder',
        name: 'nested',
        parentFolderId: 'root',
        orderKey: 'a0',
        createdAt: 2
      }
    ]
    data.data.pages = [
      {
        id: 'one',
        kind: 'page',
        name: 'one',
        parentFolderId: 'root',
        orderKey: 'a1',
        createdAt: 3
      },
      { id: 'two', kind: 'page', name: 'two', parentFolderId: 'root', orderKey: 'a2', createdAt: 4 }
    ]
    data.data.messages = []
    expect((await restore(input(data))).error).toBeUndefined()
    const tree = (await runtime.query('tree.get', undefined)) as PageTree
    expect(childrenOf(tree, 'root').map((n) => n.name)).toEqual(['nested', 'one', 'two'])
    const exported: BackupData = { version: '2.0.0', exportedAt: 9, data: tree }
    const result = await restore(input(exported))
    expect(result.error).toBeUndefined()
    const next = (await runtime.query('tree.get', undefined)) as PageTree
    expect(childrenOf(next, result.ids.folders.root).map((n) => n.name)).toEqual([
      'nested',
      'one',
      'two'
    ])
    expect(validateOrderKeys([...next.folders, ...next.pages])).toEqual([])
    for (const old of [...tree.folders, ...tree.pages])
      expect([...next.folders, ...next.pages].find((n) => n.id === old.id)!.orderKey).toBe(
        old.orderKey
      )
  })

  it('不同缺失父级的配置提升到根时统一分配键', async () => {
    const data = backup()
    const original = data.data.settings!.llmConfigs!.items[0]
    data.data.settings!.llmConfigs!.items.push({
      ...original,
      id: 'second',
      parentFolderId: 'other-missing'
    })
    const value = input(data)
    value.selection.llmFolders = []
    expect((await restore(value)).error).toBeUndefined()
    const tree = ((await runtime.query('settings.get', undefined)) as SettingsSnapshot).settings
      .llmConfigs
    expect(tree.items.every((n) => n.parentFolderId === undefined)).toBe(true)
    expect(validateOrderKeys([...tree.folders, ...tree.items])).toEqual([])
  })
  it('父级先创建，保留消息、分支和话题；缺少附件不阻断文本', async () => {
    const data = backup(),
      result = await restore(input(data))
    expect(result.error).toBeUndefined()
    expect(result.counts).toMatchObject({
      pages: 1,
      folders: 2,
      messages: 3,
      configs: 1,
      configFolders: 2
    })
    const tree = (await runtime.query('tree.get', undefined)) as PageTree
    expect(tree.pages[0].parentFolderId).toBe(result.ids.folders.child)
    expect(tree.folders.find((item) => item.id === result.ids.folders.child)?.parentFolderId).toBe(
      result.ids.folders.parent
    )
    const record = (await runtime.query('conversation.get', {
      pageId: result.ids.pages.page
    })) as Conversation
    expect(
      record.messages.map((item) => [item.id, item.parentMessageId, item.branchIndex])
    ).toEqual([
      ['user', undefined, 0],
      ['answer', 'user', 0],
      ['branch', 'user', 1]
    ])
    expect(record.topics).toEqual(data.data.messages![0].topics)
    expect(record.selectedMessageId).toBe('user')
  })

  it.each(['generate-new', 'skip', 'overwrite'] as const)(
    '重复导入的 %s 策略同时应用于页面和配置树',
    async (strategy) => {
      await restore(input())
      const data = backup()
      data.data.messages![0].messages[1].content = 'updated'
      data.data.settings!.llmConfigs!.items[0].name = 'updated LLM'
      const result = await restore(input(data, strategy))
      expect(result.error).toBeUndefined()
      const tree = (await runtime.query('tree.get', undefined)) as PageTree
      const settings = ((await runtime.query('settings.get', undefined)) as SettingsSnapshot)
        .settings
      expect(tree.pages).toHaveLength(strategy === 'generate-new' ? 2 : 1)
      expect(settings.llmConfigs.items).toHaveLength(strategy === 'generate-new' ? 2 : 1)
      const pageId = result.ids.pages.page
      expect(pageId).toEqual(
        strategy === 'generate-new' ? expect.not.stringMatching(/^page$/) : 'page'
      )
      const record = (await runtime.query('conversation.get', { pageId })) as Conversation
      expect(record.messages[1].content).toBe(strategy === 'skip' ? 'answer' : 'updated')
      expect(record.messages[1].llmId).toBe(result.ids.llm.llm)
      const view = (await runtime.query('viewState.get', undefined)) as ReturnType<
        typeof defaultViewState
      >
      expect(view.tabs.find((tab) => tab.id === view.activeTabId)?.dataId).toBe(pageId)
      expect(
        settings.llmConfigs.items.find((item) => item.id === result.ids.llm.llm)?.parentFolderId
      ).toBe(result.ids.llmFolders.lc)
    }
  )

  it('未选中的父文件夹不存在时提升到根并返回提示；本地已有父级则复用', async () => {
    const value = input()
    value.selection.folders = []
    const result = await restore(value)
    expect(result.warnings.join(' ')).toContain('提升至根目录')
    expect(
      ((await runtime.query('tree.get', undefined)) as PageTree).pages[0].parentFolderId
    ).toBeUndefined()
  })

  it('写入故障停止后续导入并报告完成数量，不自动重试', async () => {
    const data = backup()
    data.data.pages!.push(
      { ...data.data.pages![0], id: 'second', name: 'second', orderKey: 'a1' },
      { ...data.data.pages![0], id: 'third', name: 'third', orderKey: 'a2' }
    )
    data.data.messages!.push(
      { ...data.data.messages![0], pageId: 'second' },
      { ...data.data.messages![0], pageId: 'third' }
    )
    const ws = (runtime as unknown as { workspace: WorkspaceStore }).workspace
    const original = ws.writeConversation.bind(ws)
    const write = vi.spyOn(ws, 'writeConversation').mockImplementation(async (conversation) => {
      if (conversation.pageId === 'second' && conversation.messages.length)
        throw new Error('disk full')
      await original(conversation)
    })
    const result = await restore(input(data))
    expect(result.error).toBe('disk full')
    expect(result.counts.pages).toBe(1)
    expect(ws.getPage('second')).toBeUndefined()
    expect(result.ids.pages.second).toBeUndefined()
    expect(ws.getPage('third')).toBeUndefined()
    expect(
      write.mock.calls.filter(
        ([conversation]) => conversation.pageId === 'second' && conversation.messages.length
      )
    ).toHaveLength(1)
  })

  it('在写入前校验循环、消息引用和附件路径', async () => {
    const data = backup()
    data.data.messages![0].messages[1].parentMessageId = 'missing'
    await expect(restore(input(data))).rejects.toMatchObject({ code: 'backup.invalid-reference' })
    data.data.messages![0].messages[1].parentMessageId = 'user'
    data.data.messages![0].messages[0].attachments![0].relativePath = 'private.txt'
    await expect(restore(input(data))).rejects.toMatchObject({ code: 'attachment.invalid-path' })
    const cycle = backup()
    cycle.data.folders![1].parentFolderId = 'child'
    await expect(restore(input(cycle))).rejects.toMatchObject({ code: 'backup.folder-cycle' })
    expect(await runtime.query('tree.get', undefined)).toMatchObject({ folders: [], pages: [] })
  })
})

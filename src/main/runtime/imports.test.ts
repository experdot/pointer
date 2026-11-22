import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { currentPath } from '@shared/domain'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'
import { deepseekExport } from '../../../tests/fixtures/deepseek'
import * as fsx from './fsx'

let f: KernelFixture
const pointer = {
  type: 'chats-only',
  pages: [1, 2].map((index) => ({
    id: `p${index}`,
    title: `对话${index}`,
    createdAt: 1700000000000 + index,
    messages: [
      { id: `u${index}`, role: 'user', content: `问题${index}`, timestamp: 1700000000000 }
    ],
    currentPath: [`u${index}`]
  }))
}

const splitSession = {
  id: 'session-1',
  title: '新版会话',
  inserted_at: '2026-11-22T07:00:00Z',
  current_message_id: 2,
  messages: [
    { id: 1, parent_id: null, role: 'USER', fragments: [{ type: 'FILE', files: [] }] },
    {
      id: 2,
      parent_id: 1,
      role: 'ASSISTANT',
      inserted_at: '2026-11-22T07:02:00Z',
      fragments: [
        { type: 'THINK', content: '思考' },
        { type: 'TOOL_SEARCH', results: [] },
        { type: 'RESPONSE', content: '回答一' },
        { type: 'RESPONSE', content: '回答二' }
      ]
    },
    {
      id: 3,
      parent_id: 1,
      role: 'ASSISTANT',
      inserted_at: '2026-11-22T07:01:00Z',
      fragments: [{ type: 'RESPONSE', content: '其他回答' }]
    },
    { id: 4, parent_id: null, role: 'USER', fragments: [] },
    { id: 5, parent_id: 4, role: 'ASSISTANT', fragments: [] }
  ]
}
const otherSession = { ...splitSession, id: 'session-2', title: '另一个会话' }

async function writeDeepSeekIndex(
  sessions: (typeof splitSession)[]
): Promise<{ indexPath: string; sessionsPath: string }> {
  const root = join(f.root, 'deepseek-export')
  const indexPath = join(root, 'chat_session_index.json')
  const sessionsPath = join(root, 'chat_sessions')
  await mkdir(sessionsPath, { recursive: true })
  await writeFile(
    indexPath,
    JSON.stringify(
      sessions.map(({ id, title, inserted_at, messages }) => ({
        id,
        title,
        inserted_at,
        message_count: messages.length
      }))
    )
  )
  return { indexPath, sessionsPath }
}

beforeEach(async () => {
  f = await createKernel()
})
afterEach(async () => {
  await f.dispose()
})

describe('第三方导入的选择、计数和事务', () => {
  it('DeepSeek 搜索、思考和多段回答可以写入 SQLite，重启后正文与思考均保留', async () => {
    const payload = deepseekExport([
      { type: 'SEARCH', results: [] },
      { type: 'THINK', content: '思考一' },
      { type: 'TOOL_OPEN', results: [] },
      { type: 'THINK', content: '思考二' },
      { type: 'RESPONSE', content: '回答一' },
      { type: 'RESPONSE', content: '回答二' }
    ])
    expect(
      await f.command('library.import', { source: 'deepseek', payload: JSON.stringify(payload) })
    ).toEqual({ importedPages: 1, importedMessages: 2 })
    await f.restart()
    const tree = await f.query('tree.get', undefined)
    const conversation = await f.query('conversation.get', { pageId: tree.pages[0].id })
    expect(conversation.messages[1]).toMatchObject({
      id: '2',
      role: 'assistant',
      content: '回答一\n\n回答二',
      reasoning: '思考一\n\n思考二',
      parentMessageId: '1'
    })
    expect(conversation.leafMessageId).toBe('2')
  })

  it('只导入选中的对话，父目录、顺序和内容重启后保持一致', async () => {
    expect(
      await f.command('library.import', {
        source: 'pointer',
        payload: JSON.stringify(pointer),
        ids: ['p2'],
        folderName: '导入'
      })
    ).toEqual({ importedPages: 1, importedMessages: 1 })
    await f.restart()
    const tree = await f.query('tree.get', undefined)
    expect(tree.pages).toHaveLength(1)
    expect(tree.pages[0]).toMatchObject({ name: '对话2', parentFolderId: tree.folders[0].id })
    expect(
      (await f.query('conversation.get', { pageId: tree.pages[0].id })).messages[0].content
    ).toBe('问题2')
  })
  it('显式空选择、非法 JSON 和空文件不写入页面或目录', async () => {
    await expect(
      f.command('library.import', {
        source: 'pointer',
        payload: JSON.stringify(pointer),
        ids: [],
        folderName: '不应创建'
      })
    ).rejects.toMatchObject({ code: 'library.empty' })
    await expect(
      f.command('library.import', { source: 'pointer', payload: '{' })
    ).rejects.toMatchObject({ code: 'library.invalid-json' })
    await expect(
      f.command('library.import', { source: 'chatgpt', payload: '[]' })
    ).rejects.toMatchObject({ code: 'library.empty' })
    expect(await f.query('tree.get', undefined)).toEqual({ pages: [], folders: [] })
  })
  it('一个文件内第二个会话写入失败，整个文件回滚，后续重试不会重复导入', async () => {
    const write = fsx.writeTextAtomic
    vi.spyOn(fsx, 'writeTextAtomic').mockImplementation(async (path, text) => {
      if (path.endsWith('.pointer.md') && text.includes('问题2')) throw new Error('导入磁盘满')
      return write(path, text)
    })
    await expect(
      f.command('library.import', {
        source: 'pointer',
        payload: JSON.stringify(pointer),
        folderName: '导入'
      })
    ).rejects.toThrow('导入磁盘满')
    expect(await f.query('tree.get', undefined)).toEqual({ pages: [], folders: [] })
    vi.restoreAllMocks()
    await f.restart()
    expect(await f.query('tree.get', undefined)).toEqual({ pages: [], folders: [] })
    expect(
      await f.command('library.import', {
        source: 'pointer',
        payload: JSON.stringify(pointer),
        folderName: '导入'
      })
    ).toEqual({ importedPages: 2, importedMessages: 2 })
    expect((await f.query('tree.get', undefined)).pages).toHaveLength(2)
  })
})

describe('新版 DeepSeek 索引导入', () => {
  it('只读选中的文件，重启后保留完整消息树和原来选中的较早分支', async () => {
    const { indexPath, sessionsPath } = await writeDeepSeekIndex([splitSession, otherSession])
    await writeFile(join(sessionsPath, 'session-1.json'), JSON.stringify(splitSession))
    const draft = await f.runtime.prepareDeepSeekIndex(indexPath)
    expect(draft).toEqual({
      draftId: expect.any(String),
      sessions: [splitSession, otherSession].map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: Date.parse(session.inserted_at),
        messageCount: 5
      }))
    })
    expect((await f.query('tree.get', undefined)).pages).toEqual([])

    const input = { draftId: draft.draftId, ids: [splitSession.id] }
    const results = await Promise.allSettled([
      f.command('library.importDeepSeekIndex', input),
      f.command('library.importDeepSeekIndex', input)
    ])
    expect(results).toMatchObject([
      { status: 'fulfilled', value: { importedPages: 1, importedMessages: 5 } },
      { status: 'rejected', reason: { code: 'library.deepseek-busy' } }
    ])
    await expect(f.command('library.importDeepSeekIndex', input)).rejects.toMatchObject({
      code: 'library.deepseek-draft-expired'
    })

    await f.restart()
    const { pages } = await f.query('tree.get', undefined)
    expect(pages).toHaveLength(1)
    const conversation = await f.query('conversation.get', { pageId: pages[0].id })
    expect(conversation.messages).toMatchObject([
      { id: '1', role: 'user', content: '', parentMessageId: undefined, branchIndex: 0 },
      {
        id: '2',
        content: '回答一\n\n回答二',
        reasoning: '思考',
        parentMessageId: '1',
        branchIndex: 0
      },
      { id: '3', parentMessageId: '1', branchIndex: 1 },
      { id: '4', role: 'user', content: '', parentMessageId: undefined, branchIndex: 1 },
      { id: '5', parentMessageId: '4', branchIndex: 0 }
    ])
    expect(conversation.leafMessageId).toBe('2')
    expect(currentPath(conversation).map((message) => message.id)).toEqual(['1', '2'])
  })

  it('报告缺失、损坏和树引用错误的文件，修复后可用原选项重新导入', async () => {
    const { indexPath, sessionsPath } = await writeDeepSeekIndex([splitSession, otherSession])
    await writeFile(join(sessionsPath, 'session-1.json'), JSON.stringify(splitSession))
    const secondPath = join(sessionsPath, 'session-2.json')
    const draft = await f.runtime.prepareDeepSeekIndex(indexPath)
    const input = { draftId: draft.draftId, ids: [splitSession.id, otherSession.id] }

    for (const [data, reason] of [
      [undefined, '找不到文件'],
      ['{', '导入文件不是合法 JSON'],
      [JSON.stringify(splitSession), '会话 ID 与索引不一致'],
      [
        JSON.stringify({
          ...otherSession,
          messages: [
            { ...otherSession.messages[0], parent_id: 99 },
            ...otherSession.messages.slice(1)
          ]
        }),
        '消息 1 的父消息不存在'
      ]
    ] as const) {
      if (data !== undefined) await writeFile(secondPath, data)
      await expect(f.command('library.importDeepSeekIndex', input)).rejects.toMatchObject({
        code: 'library.deepseek-file',
        localized: {
          key: 'errors.import.deepSeekFile',
          values: { v0: 'chat_sessions/session-2.json', v1: reason }
        }
      })
      expect(await f.query('tree.get', undefined)).toEqual({ pages: [], folders: [] })
    }

    await writeFile(secondPath, JSON.stringify(otherSession))
    expect(await f.command('library.importDeepSeekIndex', input)).toEqual({
      importedPages: 2,
      importedMessages: 10
    })
  })

  it('校验索引文件名和会话 ID，工作区切换后拒绝旧草稿', async () => {
    await expect(f.runtime.prepareDeepSeekIndex('chat_session_index.json')).rejects.toMatchObject({
      code: 'library.deepseek-local-index'
    })
    await expect(f.runtime.prepareDeepSeekIndex(join(f.root, 'export.json'))).rejects.toMatchObject(
      {
        code: 'library.deepseek-index-name'
      }
    )
    const { indexPath } = await writeDeepSeekIndex([{ ...splitSession, id: '../outside' }])
    await expect(f.runtime.prepareDeepSeekIndex(indexPath)).rejects.toMatchObject({
      code: 'library.deepseek-file',
      localized: { values: { v0: 'chat_session_index.json', v1: '非法实体标识' } }
    })

    await writeDeepSeekIndex([splitSession])
    const scopeId = f.runtime.getScopeId()
    const draft = await f.runtime.prepareDeepSeekIndex(indexPath, scopeId)
    await f.command('workspace.create', {
      name: '另一个工作区',
      type: 'custom',
      path: join(f.root, 'other-workspace')
    })
    await expect(
      f.command('library.importDeepSeekIndex', { draftId: draft.draftId, ids: [splitSession.id] })
    ).rejects.toMatchObject({ code: 'library.deepseek-draft-expired' })
    await expect(f.runtime.prepareDeepSeekIndex(indexPath, scopeId)).rejects.toMatchObject({
      code: 'runtime.stale-scope'
    })
    expect((await f.query('tree.get', undefined)).pages).toEqual([])
  })
})

it('独立导入新版 DeepSeek 单会话，重启后恢复整棵树及非末尾的选中分支', async () => {
  expect(
    await f.command('library.import', {
      source: 'deepseek',
      payload: JSON.stringify(splitSession),
      ids: [splitSession.id]
    })
  ).toEqual({ importedPages: 1, importedMessages: 5 })

  await f.restart()
  const { pages } = await f.query('tree.get', undefined)
  expect(pages).toHaveLength(1)
  const conversation = await f.query('conversation.get', { pageId: pages[0].id })
  expect(conversation.messages.map(({ id, parentMessageId }) => [id, parentMessageId])).toEqual([
    ['1', undefined],
    ['2', '1'],
    ['3', '1'],
    ['4', undefined],
    ['5', '4']
  ])
  expect(currentPath(conversation).map((message) => message.id)).toEqual(['1', '2'])
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SEARCH_OPTIONS, type ChatMessage } from '@shared/domain'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'

let f: KernelFixture
beforeEach(async () => {
  f = await createKernel()
})
afterEach(async () => {
  await f.dispose()
})

async function messages(contents: string[], folder?: string): Promise<string> {
  const page = await f.command('page.create', { name: '检索', parentFolderId: folder })
  await f.command('conversation.replace', {
    pageId: page.id,
    conversation: {
      pageId: page.id,
      topics: [],
      messages: contents.map((content, index) => ({
        id: `m-${index}`,
        role: 'user',
        content,
        createdAt: Date.now(),
        branchIndex: index
      }))
    }
  })
  return page.id
}

describe('SQLite 工作区检索边界', () => {
  it('慢正则不占用工作区事务队列，超时后仍可搜索', async () => {
    await messages(['a'.repeat(30000) + '!'])
    let finished = false
    const slow = f
      .query('search.workspace', {
        query: '(a+)+$',
        options: { ...DEFAULT_SEARCH_OPTIONS, useRegex: true }
      })
      .catch((error) => error)
      .finally(() => {
        finished = true
      })
    expect((await f.query('tree.get', undefined)).pages).toHaveLength(1)
    expect(finished).toBe(false)
    expect(await slow).toMatchObject({ code: 'search.timeout' })
    expect(
      (await f.query('search.workspace', { query: '!', options: DEFAULT_SEARCH_OPTIONS })).total
    ).toBe(1)
  })

  it('会话搜索支持尚未落盘的流式内容，并在关闭时取消任务', async () => {
    const options = { matchCase: false, matchWholeWord: false, useRegex: false }
    expect(
      await f.query('search.messages', {
        messages: [{ id: 'streaming', content: '😀 tail' }],
        query: 'tail',
        options
      })
    ).toEqual([{ messageId: 'streaming', startOffset: 3, endOffset: 7, globalIndex: 0 }])
    const pending = f
      .query('search.messages', {
        messages: [{ id: 'x', content: 'a'.repeat(30000) + '!' }],
        query: '(a+)+$',
        options: { ...options, useRegex: true }
      })
      .catch((error) => error)
    await f.restart()
    expect(await pending).toMatchObject({ code: 'search.superseded' })
    expect(await f.query('search.messages', { messages: [], query: 'a', options })).toEqual([])
  })

  it('2000 个较早候选不能挡住后面的角色命中，总数包含全部结果', async () => {
    const page = await f.command('page.create', { name: '大结果集' })
    const entries: ChatMessage[] = Array.from({ length: 2001 }, (_, index) => ({
      id: `m-${index}`,
      role: index === 2000 ? 'assistant' : 'user',
      content: `needle ${index}`,
      createdAt: index + 1,
      branchIndex: index
    }))
    await f.command('conversation.replace', {
      pageId: page.id,
      conversation: { pageId: page.id, topics: [], messages: entries }
    })
    const filtered = await f.query('search.workspace', {
      query: 'needle',
      options: { ...DEFAULT_SEARCH_OPTIONS, roleFilter: 'assistant' }
    })
    expect(filtered.total).toBe(1)
    expect(filtered.groups[0].messageGroups[0].messageId).toBe('m-2000')
    const all = await f.query('search.workspace', {
      query: 'needle',
      options: DEFAULT_SEARCH_OPTIONS
    })
    expect(all.total).toBe(2001)
  })

  it.each(['中', '中文', '中文词', '😀', '😀😀', '😀😀😀'])(
    '查询 %s 按 Unicode 字符长度选择候选，保持高亮偏移',
    async (query) => {
      const id = await messages([`前缀 ${query} 后缀`])
      const result = await f.query('search.workspace', { query, options: DEFAULT_SEARCH_OPTIONS })
      expect(result.total).toBe(1)
      const match = result.groups[0].messageGroups[0].matches[0]
      expect(match.pageId).toBe(id)
      expect(match.contentEnd - match.contentStart).toBe(query.length)
      expect(match.snippet.slice(match.matchStart, match.matchEnd)).toBe(query)
    }
  )

  it('文件夹筛选包含后代，不包含兄弟或根页面；索引重启后仍可检索', async () => {
    const parent = await f.command('folder.create', { name: '父' })
    const child = await f.command('folder.create', { name: '子', parentFolderId: parent.id })
    const nested = await messages(['target'], child.id)
    await messages(['target'])
    await f.restart()
    const result = await f.query('search.workspace', {
      query: 'target',
      options: { ...DEFAULT_SEARCH_OPTIONS, folderIds: [parent.id] }
    })
    expect(result.total).toBe(1)
    expect(result.groups[0]).toMatchObject({ pageId: nested, folderPath: '父 / 子' })
    expect(
      (
        await f.query('search.workspace', {
          query: 'target',
          options: { ...DEFAULT_SEARCH_OPTIONS, folderIds: ['missing'] }
        })
      ).total
    ).toBe(0)
  })

  it.each([
    ['k', 'K'],
    ['s', 'ſ'],
    ['σ', 'ς'],
    ['KEL', 'Kelvin']
  ])('不区分大小写的 %s 能找到 Unicode 等价字符 %s', async (query, content) => {
    await messages([content])
    const result = await f.query('search.workspace', { query, options: DEFAULT_SEARCH_OPTIONS })
    expect(result.total).toBe(1)
  })

  it('今天的日期边界使用本地午夜，SQL 通配符按字面量检索', async () => {
    const now = new Date(2026, 10, 11, 12).getTime()
    const midnight = new Date(2026, 10, 11).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const page = await messages(['a%_b', 'a%_b', 'aXXb'])
    const conversation = await f.query('conversation.get', { pageId: page })
    conversation.messages[0].createdAt = midnight - 1
    conversation.messages[1].createdAt = midnight
    await f.command('conversation.replace', { pageId: page, conversation })
    const result = await f.query('search.workspace', {
      query: '%_',
      options: { ...DEFAULT_SEARCH_OPTIONS, timeRange: 'today' }
    })
    expect(result.total).toBe(1)
    expect(result.groups[0].messageGroups[0].messageId).toBe('m-1')
  })

  it('非法正则返回空结果，Unicode 整词和多次出现按真实位置分组', async () => {
    await messages(['alpha alphabet alpha 😀'])
    expect(
      (
        await f.query('search.workspace', {
          query: '[',
          options: { ...DEFAULT_SEARCH_OPTIONS, useRegex: true }
        })
      ).total
    ).toBe(0)
    const result = await f.query('search.workspace', {
      query: 'alpha',
      options: { ...DEFAULT_SEARCH_OPTIONS, matchWholeWord: true }
    })
    expect(result.total).toBe(2)
    expect(result.groups[0].messageGroups[0].matches.map((match) => match.contentStart)).toEqual([
      0, 15
    ])
  })
})

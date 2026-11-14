import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

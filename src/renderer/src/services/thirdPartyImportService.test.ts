import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importConversations } from './thirdPartyImportService'
import { command } from '../runtime/client'

vi.mock('../runtime/client', () => ({ command: vi.fn() }))
beforeEach(() => vi.mocked(command).mockReset())
describe('多文件导入汇总', () => {
  it.each(['openai', 'deepseek', 'pointer'] as const)(
    '来源 %s 正确映射并透传选择',
    async (platform) => {
      vi.mocked(command).mockResolvedValue({ importedPages: 2, importedMessages: 4 })
      expect(
        await importConversations([{ name: 'test.json', content: '{}' }], {
          platform,
          folderName: 'folder',
          ids: ['x']
        })
      ).toEqual({ success: 2, failed: 0, skipped: 0, errors: [] })
      expect(command).toHaveBeenCalledWith('library.import', {
        source: platform === 'openai' ? 'chatgpt' : platform,
        payload: '{}',
        folderName: 'folder',
        ids: ['x']
      })
    }
  )
  it('多文件部分失败保留成功数量、文件名和错误，不自动重复提交', async () => {
    vi.mocked(command)
      .mockResolvedValueOnce({ importedPages: 3, importedMessages: 5 })
      .mockRejectedValueOnce(new Error('无效 JSON'))
      .mockResolvedValueOnce({ importedPages: 0, importedMessages: 0 })
    expect(
      await importConversations(
        ['a', 'b', 'c'].map((name) => ({ name, content: '{}' })),
        { platform: 'pointer' }
      )
    ).toEqual({
      success: 3,
      failed: 1,
      skipped: 1,
      errors: ['b：无效 JSON', 'c：没有可导入的对话']
    })
    expect(command).toHaveBeenCalledTimes(3)
  })
})

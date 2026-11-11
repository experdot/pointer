import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'
import * as fsx from './fsx'

let f: KernelFixture
let pageId: string
const image = {
  name: '../中文🧪.txt',
  mimeType: 'image/png',
  dataBase64: Buffer.from([0, 1, 255, 0, 27]).toString('base64')
}
beforeEach(async () => {
  f = await createKernel()
  pageId = (await f.command('page.create', { name: '附件' })).id
})
afterEach(async () => {
  await f.dispose()
})

describe('附件文件生命周期', () => {
  it('二进制导入、消息引用、重启、读取和删除保持一致，路径使用受控扩展名', async () => {
    const [ref] = await f.command('attachment.import', { pageId, files: [image] })
    expect(ref).toMatchObject({ name: image.name, size: 5, mimeType: 'image/png' })
    expect(ref.relativePath.split('/')).toHaveLength(3)
    await f.command('conversation.replace', {
      pageId,
      conversation: {
        pageId,
        messages: [
          { id: 'm', role: 'user', content: '', createdAt: 1, branchIndex: 0, attachments: [ref] }
        ],
        topics: []
      }
    })
    await f.restart()
    expect((await f.query('conversation.get', { pageId })).messages[0].attachments).toEqual([ref])
    expect(await f.query('attachment.read', { relativePath: ref.relativePath })).toEqual({
      mimeType: 'image/png',
      dataBase64: image.dataBase64
    })
    await f.command('attachment.delete', { relativePath: ref.relativePath })
    await expect(
      f.query('attachment.read', { relativePath: ref.relativePath })
    ).rejects.toMatchObject({ code: 'attachment.not-found' })
  })

  it.each([
    [{ ...image, mimeType: 'image/svg+xml' }, 'attachment.invalid-type'],
    [{ ...image, dataBase64: '$invalid' }, 'attachment.invalid-data'],
    [{ ...image, dataBase64: '' }, 'attachment.invalid-data'],
    [
      { ...image, dataBase64: 'A'.repeat(Math.ceil((10 * 1024 * 1024) / 3) * 4 + 4) },
      'attachment.too-large'
    ]
  ])('拒绝无效附件且整个批次不留文件：%s', async (invalid, code) => {
    await expect(
      f.command('attachment.import', { pageId, files: [image, invalid] })
    ).rejects.toMatchObject({ code })
    const session = await f.query('session.get', undefined)
    expect(await readdir(join(session.workspacePath!, '.pointer/attachments'))).toEqual([])
    await f.restart()
    expect(await readdir(join(session.workspacePath!, '.pointer/attachments'))).toEqual([])
  })

  it('第二个文件落盘失败时回滚第一个，删除失败保留原文件', async () => {
    const write = fsx.writeBinaryAtomic
    let count = 0
    vi.spyOn(fsx, 'writeBinaryAtomic').mockImplementation(async (path, value) => {
      if (++count === 2) throw new Error('磁盘已满')
      return write(path, value)
    })
    await expect(f.command('attachment.import', { pageId, files: [image, image] })).rejects.toThrow(
      '磁盘已满'
    )
    const session = await f.query('session.get', undefined)
    expect(await readdir(join(session.workspacePath!, '.pointer/attachments'))).toEqual([])
    vi.restoreAllMocks()
    const [ref] = await f.command('attachment.import', { pageId, files: [image] })
    vi.spyOn(fsx, 'removePath').mockRejectedValueOnce(new Error('文件占用'))
    await expect(
      f.command('attachment.delete', { relativePath: ref.relativePath })
    ).rejects.toThrow('文件占用')
    expect((await f.query('attachment.read', { relativePath: ref.relativePath })).dataBase64).toBe(
      image.dataBase64
    )
  })

  it('已删除页面不能导入，越界路径不能读写', async () => {
    await f.command('page.delete', { pageIds: [pageId] })
    await expect(f.command('attachment.import', { pageId, files: [image] })).rejects.toMatchObject({
      code: 'page.not-found'
    })
    for (const path of [
      '../settings.json',
      '.pointer/attachments/../../outside',
      'C:/outside.png'
    ]) {
      await expect(f.query('attachment.read', { relativePath: path })).rejects.toMatchObject({
        code: 'attachment.invalid-path'
      })
      await expect(f.command('attachment.delete', { relativePath: path })).rejects.toMatchObject({
        code: 'attachment.invalid-path'
      })
    }
  })
})

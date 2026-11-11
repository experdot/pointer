import { join } from 'node:path'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDirectory } from '../../../tests/helpers/temp'
import { WorkspaceTransaction } from './WorkspaceTransaction'
import * as fsx from './fsx'

let directory: Awaited<ReturnType<typeof testDirectory>>
beforeEach(async () => {
  directory = await testDirectory()
})
afterEach(async () => {
  vi.restoreAllMocks()
  await directory.remove()
})

describe('工作区写前日志', () => {
  it('多次覆盖、删除和新增文件在重开后整体恢复，重复恢复不改变结果', async () => {
    const original = join(directory.path, 'original')
    const created = join(directory.path, 'created')
    await writeFile(original, '原始 🧪')
    const transaction = new WorkspaceTransaction(directory.path)
    await transaction.capture(original)
    await writeFile(original, '修改一')
    await transaction.capture(original)
    await rm(original)
    await transaction.capture(created)
    await writeFile(created, '新增')
    await WorkspaceTransaction.recover(directory.path)
    expect(await readFile(original, 'utf8')).toBe('原始 🧪')
    expect(await fsx.pathExists(created)).toBe(false)
    await WorkspaceTransaction.recover(directory.path)
    expect(await readFile(original, 'utf8')).toBe('原始 🧪')
  })

  it('恢复已移除的空目录，保留新目录中用户另外放入的文件', async () => {
    const old = join(directory.path, 'old')
    const added = join(directory.path, 'added')
    await mkdir(old)
    const transaction = new WorkspaceTransaction(directory.path)
    await transaction.capture(old, 'directory')
    await rm(old, { recursive: true })
    await transaction.capture(added, 'directory')
    await mkdir(added)
    await writeFile(join(added, 'personal.txt'), '用户内容')
    await transaction.rollback()
    expect(await fsx.isDirectory(old)).toBe(true)
    expect(await readFile(join(added, 'personal.txt'), 'utf8')).toBe('用户内容')
  })

  it('恢复中途失败后再次打开可以完成恢复', async () => {
    const paths = ['a', 'b'].map((name) => join(directory.path, name))
    const transaction = new WorkspaceTransaction(directory.path)
    for (const path of paths) {
      await writeFile(path, 'before')
      await transaction.capture(path)
      await writeFile(path, 'after')
    }
    const write = fsx.writeBinaryAtomic
    vi.spyOn(fsx, 'writeBinaryAtomic').mockImplementation(async (path, bytes) => {
      if (path === paths[1]) throw new Error('恢复写入失败')
      await write(path, bytes)
    })
    await expect(transaction.rollback()).rejects.toThrow('恢复写入失败')
    vi.restoreAllMocks()
    await WorkspaceTransaction.recover(directory.path)
    expect(await Promise.all(paths.map((path) => readFile(path, 'utf8')))).toEqual([
      'before',
      'before'
    ])
  })

  it('提交后重开保留新值并清理记录', async () => {
    const path = join(directory.path, 'value')
    const transaction = new WorkspaceTransaction(directory.path)
    await transaction.capture(path)
    await writeFile(path, 'committed')
    await transaction.commit()
    await WorkspaceTransaction.recover(directory.path)
    expect(await readFile(path, 'utf8')).toBe('committed')
    expect(await fsx.listDirectories(join(directory.path, '.pointer', 'transactions'))).toEqual([])
  })

  it.each(['../outside', '.pointer/transactions/elsewhere'])(
    '拒绝损坏清单的路径 %s',
    async (path) => {
      const transaction = new WorkspaceTransaction(directory.path)
      await transaction.capture(join(directory.path, 'valid'))
      const journal = join(directory.path, '.pointer', 'transactions')
      const [id] = await readdir(journal)
      await fsx.writeJsonAtomic(join(journal, id, 'manifest.json'), {
        version: 1,
        committed: false,
        entries: [{ kind: 'file', path, backup: null }]
      })
      await expect(WorkspaceTransaction.recover(directory.path)).rejects.toThrow()
      expect(await fsx.pathExists(join(journal, id, 'manifest.json'))).toBe(true)
    }
  )

  it('备份缺失时在修改任何目标之前停止，保留诊断资料', async () => {
    const path = join(directory.path, 'keep')
    await writeFile(path, 'before')
    const transaction = new WorkspaceTransaction(directory.path)
    await transaction.capture(path)
    await writeFile(path, 'after')
    const journal = join(directory.path, '.pointer', 'transactions')
    const [id] = await readdir(journal)
    await rm(join(journal, id, '0.bin'))
    await expect(WorkspaceTransaction.recover(directory.path)).rejects.toThrow('恢复备份缺失')
    expect(await readFile(path, 'utf8')).toBe('after')
  })
})

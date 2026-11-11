import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { testDirectory } from '../../../tests/helpers/temp'
import { WorkspaceLease } from './WorkspaceLease'

let dir: Awaited<ReturnType<typeof testDirectory>>
let leases: WorkspaceLease[]
beforeEach(async () => {
  dir = await testDirectory()
  leases = []
})
afterEach(async () => {
  for (const lease of leases) await lease.release()
  await dir.remove()
})

describe('工作区写入权', () => {
  it('并发竞争恰好一个成功，失败方不能释放持有者，释放后可重新取得', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => WorkspaceLease.acquire(dir.path))
    )
    for (const result of results) if (result.status === 'fulfilled') leases.push(result.value)
    expect(leases).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(11)
    await expect(WorkspaceLease.acquire(dir.path)).rejects.toMatchObject({
      code: 'workspace.in-use'
    })
    await leases.pop()!.release()
    leases.push(await WorkspaceLease.acquire(dir.path))
  })

  it('确认持有进程已经退出后恢复遗留锁，不留下临时目录', async () => {
    const child = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true })
    expect(child.status).toBe(0)
    const lock = join(dir.path, 'write.lock')
    await mkdir(lock)
    await writeFile(join(lock, `owner-${child.pid}-${randomUUID()}`), '')
    leases.push(await WorkspaceLease.acquire(dir.path))
    expect(await readdir(dir.path)).toEqual(['write.lock'])
    await leases.pop()!.release()
    expect(await readdir(dir.path)).toEqual([])
  })

  it('无法识别的锁文件明确拒绝，保留原文件供恢复', async () => {
    const lock = join(dir.path, 'write.lock')
    await mkdir(lock)
    await writeFile(join(lock, 'unknown'), '不可删除')
    await expect(WorkspaceLease.acquire(dir.path)).rejects.toMatchObject({
      code: 'workspace.in-use'
    })
    expect(await readdir(lock)).toEqual(['unknown'])
  })
})

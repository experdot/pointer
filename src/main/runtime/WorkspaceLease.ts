import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { RuntimeError } from '@shared/contracts'

/** 非空目录原子改名取得写入权。崩溃后仅移除已退出进程的唯一 owner 文件。 */
export class WorkspaceLease {
  private constructor(
    private readonly directory: string,
    private readonly owner: string
  ) {}

  static async acquire(pointerDir: string): Promise<WorkspaceLease> {
    await mkdir(pointerDir, { recursive: true })
    const owner = `owner-${process.pid}-${randomUUID()}`
    const staging = join(pointerDir, `.lease-${owner}`)
    const directory = join(pointerDir, 'write.lock')
    await mkdir(staging)
    await writeFile(join(staging, owner), '')
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          // 目标总含 owner 文件，rename 不会覆盖另一个活动锁目录。
          await rename(staging, directory)
          return new WorkspaceLease(directory, owner)
        } catch (error) {
          let owners: string[]
          try {
            owners = await readdir(directory)
          } catch (readError) {
            if ((readError as NodeJS.ErrnoException).code === 'ENOENT') {
              if (attempt < 7) continue
              throw error
            }
            throw readError
          }
          for (const file of owners) {
            const match = /^owner-(\d+)-[\da-f-]+$/.exec(file)
            if (!match)
              throw new RuntimeError('workspace.in-use', '工作区锁无效，请检查是否仍有实例运行')
            const pid = Number(match[1])
            let alive = true
            try {
              process.kill(pid, 0)
            } catch (probe) {
              alive = (probe as NodeJS.ErrnoException).code !== 'ESRCH'
            }
            if (alive) throw new RuntimeError('workspace.in-use', '工作区已在另一个实例中打开')
            await unlink(join(directory, file)).catch((failure: NodeJS.ErrnoException) => {
              if (failure.code !== 'ENOENT') throw failure
            })
          }
          await removeIfEmpty(directory)
        }
      }
      throw new RuntimeError('workspace.in-use', '工作区正在被其他实例打开，请重试')
    } finally {
      await unlink(join(staging, owner)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
      await removeIfEmpty(staging)
    }
  }

  async release(): Promise<void> {
    await unlink(join(this.directory, this.owner)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
    await removeIfEmpty(this.directory)
  }
}

async function removeIfEmpty(path: string): Promise<void> {
  await rmdir(path).catch((error: NodeJS.ErrnoException) => {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code ?? '')) throw error
  })
}

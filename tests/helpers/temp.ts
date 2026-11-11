import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

export async function testDirectory(): Promise<{ path: string; remove: () => Promise<void> }> {
  const path = resolve(await mkdtemp(join(tmpdir(), 'pointer-test-')))
  return {
    path,
    async remove() {
      // 清理前验证最终绝对路径，只允许移除本次分配的临时目录。
      if (dirname(path) !== resolve(tmpdir()) || !basename(path).startsWith('pointer-test-')) {
        throw new Error(`非法测试清理路径：${path}`)
      }
      await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
}

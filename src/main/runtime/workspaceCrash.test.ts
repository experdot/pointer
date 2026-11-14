import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createKernel } from '../../../tests/helpers/kernel'
import { testDirectory } from '../../../tests/helpers/temp'
import { listDirectories } from './fsx'
import { nodeWorkerPlugin } from '../../../scripts/worker-build.mjs'

let bundle: Awaited<ReturnType<typeof testDirectory>>
beforeAll(async () => {
  bundle = await testDirectory()
  await build({
    entryPoints: ['tests/fixtures/crashWorkspace.ts'],
    outfile: join(bundle.path, 'crash.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    alias: { '@shared': resolve('src/shared') },
    plugins: [nodeWorkerPlugin],
    logLevel: 'silent'
  })
})
afterAll(async () => bundle?.remove())

describe('真实进程中断后的工作区恢复', () => {
  it.each([1, 2, 3, 4, 100])('交换第 %i 次移动后结束进程，重开保持完整状态', async (move) => {
    const f = await createKernel()
    try {
      const a = await f.command('folder.create', { name: 'A?' })
      const b = await f.command('folder.create', { name: 'A*', afterNodeId: a.id })
      const pa = await f.command('page.create', { name: 'same', parentFolderId: a.id })
      const pb = await f.command('page.create', { name: 'same', parentFolderId: b.id })
      for (const page of [pa, pb]) {
        await f.command('conversation.append', {
          pageId: page.id,
          draft: { id: 'keep', role: 'user', content: `不能丢失 ${page.id} 🧪` }
        })
      }
      const before = await f.query('tree.get', undefined)
      const workspace = (await f.query('workspaces.list', undefined))[0]
      await f.runtime.dispose()
      const result = await runChild(
        f.root,
        {
          name: 'tree.move',
          payload: { nodeId: b.id, targetNodeId: a.id, placement: 'before' }
        },
        'layout-',
        move
      )
      expect(result.code, result.output).toBe(move === 100 ? 0 : 99)
      await f.restart()
      const tree = await f.query('tree.get', undefined)
      if (move !== 100) expect(tree).toEqual(before)
      else
        expect(tree.folders.find((folder) => folder.id === b.id)!.order).toBeLessThan(
          tree.folders.find((folder) => folder.id === a.id)!.order
        )
      for (const page of [pa, pb]) {
        expect(tree.pages.find((item) => item.id === page.id)?.parentFolderId).toBe(
          page.parentFolderId
        )
        expect((await f.query('conversation.get', { pageId: page.id })).messages[0].content).toBe(
          `不能丢失 ${page.id} 🧪`
        )
      }
      expect(await listDirectories(join(workspace.path, '.pointer', 'transactions'))).toEqual([])
      await f.restart()
      expect(await f.query('tree.get', undefined)).toEqual(tree)
    } finally {
      await f.dispose()
    }
  })
})

function runChild(
  root: string,
  command: unknown,
  marker: string,
  count: number
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(bundle.path, 'crash.cjs'), root, JSON.stringify(command), marker, String(count)],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(output || '子进程超时'))
    }, 10000)
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      resolve({ code, output })
    })
  })
}

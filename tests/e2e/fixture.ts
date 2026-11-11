import { expect, test as base, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import type { ServerResponse } from 'node:http'
import { testDirectory } from '../helpers/temp'
import { localServer } from '../helpers/http'

interface Request {
  body: { messages: { role: string; content: unknown }[]; model: string }
  response: ServerResponse
  delta: (text: string) => void
  finish: () => void
}

interface Desktop {
  readonly app: ElectronApplication
  readonly page: Page
  root: string
  restart: () => Promise<void>
}

interface Fixtures {
  desktop: Desktop
  provider: { url: string; requests: Request[] }
}

export const test = base.extend<Fixtures>({
  desktop: async ({ playwright }, run, testInfo) => {
    const directory = await testDirectory()
    const errors: string[] = []
    const mainLog: string[] = []
    let app: ElectronApplication
    let page: Page
    let running = false
    const launch = async (): Promise<void> => {
      app = await playwright._electron.launch({
        args: [resolve('tests/fixtures/electron.cjs')],
        env: { ...process.env, ELECTRON_RENDERER_URL: '', POINTER_TEST_DATA: directory.path },
        timeout: 20000
      })
      running = true
      app.once('close', () => {
        running = false
      })
      app.process().stdout?.on('data', (chunk) => mainLog.push(String(chunk)))
      app.process().stderr?.on('data', (chunk) => mainLog.push(String(chunk)))
      page = await app.firstWindow()
      page.on('pageerror', (error) => errors.push(error.message))
      await page.waitForFunction(() => Boolean(window.runtime))
      await expect(page.locator('.main-layout')).toBeVisible()
    }
    const shutdown = async (): Promise<void> => {
      if (!running) return
      const closed = app.waitForEvent('close', { timeout: 10000 })
      await Promise.all([
        closed,
        app.evaluate(({ app }) => {
          app.quit()
        })
      ])
    }
    const cleanup = async (): Promise<void> => {
      try {
        try {
          await shutdown()
        } catch (error) {
          await testInfo.attach('main-process', {
            body: mainLog.join(''),
            contentType: 'text/plain'
          })
          await app.close()
          throw error
        }
      } finally {
        await directory.remove()
      }
    }
    try {
      await launch()
      await run({
        get app() {
          return app
        },
        get page() {
          return page
        },
        root: directory.path,
        async restart() {
          await shutdown()
          await launch()
        }
      })
      expect(errors, '渲染进程不能有未处理异常').toEqual([])
    } finally {
      if (app! && testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('desktop', {
          body: await page!.screenshot().catch(() => Buffer.from('')),
          contentType: 'image/png'
        })
        await testInfo.attach('renderer-errors', {
          body: errors.join('\n'),
          contentType: 'text/plain'
        })
      }
      await cleanup()
    }
  },
  // Playwright 的 fixture 参数必须使用解构；本地服务器不依赖其他 fixture。
  // eslint-disable-next-line no-empty-pattern
  provider: async ({}, run) => {
    const requests: Request[] = []
    const server = await localServer((request, response) => {
      if (request.url === '/v1/models') {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ data: [{ id: 'test-model' }] }))
        return
      }
      if (request.url !== '/v1/chat/completions') {
        response.writeHead(404).end()
        return
      }
      let body = ''
      request.on('data', (chunk) => {
        body += chunk
      })
      request.on('end', () => {
        const parsed = JSON.parse(body)
        if (!parsed.stream) {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
          return
        }
        response.writeHead(200, { 'Content-Type': 'text/event-stream' })
        response.flushHeaders()
        requests.push({
          body: parsed,
          response,
          delta(text) {
            response.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
            )
          },
          finish() {
            response.end('data: [DONE]\n\n')
          }
        })
      })
    })
    try {
      await run({ url: `${server.url}/v1`, requests })
    } finally {
      await server.close()
    }
  }
})

export { expect }

export async function configureThroughUI(page: Page, url: string): Promise<void> {
  await page.getByRole('button', { name: '设置', exact: true }).first().click()
  await page.getByRole('tab', { name: 'LLM 配置' }).click()
  await page.getByRole('button', { name: '新建配置' }).click()
  await page.getByLabel('配置名称', { exact: true }).fill('本地测试模型')
  await page.getByRole('combobox', { name: 'API Base URL' }).fill(url)
  await page.getByLabel('API Key', { exact: true }).fill('test-only')
  await page.getByRole('combobox', { name: '模型名称' }).fill('test-model')
  await page.getByRole('button', { name: '测试连接', exact: true }).click()
  await expect(page.getByText('连接成功', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '设为默认', exact: true }).click()
  await expect(page.getByRole('button', { name: '已设为默认', exact: true })).toBeVisible()
}

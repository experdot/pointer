import { copyFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, configureThroughUI } from './fixture'

test('粘贴和移除图片、消息附件重启、公式图表以及表格图片保存', async ({
  desktop,
  provider
}, info) => {
  const { page } = desktop
  await configureThroughUI(page, provider.url)
  await page.keyboard.press('ControlOrMeta+n')
  await expect(page.getByRole('textbox', { name: '消息内容' })).toBeEnabled()
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII='
  const attach = async (kind: 'paste' | 'drop'): Promise<void> => {
    await page.evaluate(
      ({ png, kind }) => {
        const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0))
        const transfer = new DataTransfer()
        transfer.items.add(new File([bytes], '像素.png', { type: 'image/png' }))
        const event =
          kind === 'paste'
            ? new ClipboardEvent('paste', {
                clipboardData: transfer,
                bubbles: true,
                cancelable: true
              })
            : new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })
        document.querySelector('textarea[aria-label="消息内容"]')!.dispatchEvent(event)
      },
      { png, kind }
    )
    await expect(page.locator('.attachment-preview img')).toHaveCount(1)
  }
  await attach('paste')
  await page.locator('.attachment-preview__remove').click()
  await expect(page.locator('.attachment-preview img')).toHaveCount(0)
  await attach('drop')
  await page.getByRole('textbox', { name: '消息内容' }).fill('图片与图表')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => provider.requests.length).toBe(1)
  expect(provider.requests[0].body.messages.at(-1)?.content).toEqual([
    { type: 'text', text: '图片与图表' },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } }
  ])
  provider.requests[0].delta(
    '公式 $x^2$\n\n```mermaid\ngraph TD\nA[开始] --> B[结束]\n```\n\n| 列 | 数值 |\n|---|---|\n| 中文 | 42 |'
  )
  provider.requests[0].finish()
  await expect(page.locator('.katex')).toBeVisible()
  await expect(page.locator('.mermaid svg')).toBeVisible()
  await expect(page.locator('.mermaid svg')).toContainText('开始')
  await expect(page.locator('.mermaid svg')).toContainText('结束')
  await page.screenshot({ path: info.outputPath('rich-message.png') })
  await page.getByTitle('全屏查看表格').click()
  await expect(page.getByRole('dialog', { name: '表格查看' })).toContainText('中文')
  const output = join(desktop.root, 'table.png')
  await desktop.app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output })
  }, output)
  await page.getByRole('button', { name: '导出图片', exact: true }).click()
  await expect
    .poll(async () =>
      (await readFile(output).catch(() => Buffer.alloc(0))).subarray(0, 8).toString('hex')
    )
    .toBe('89504e470d0a1a0a')
  const bytes = await readFile(output)
  expect(bytes.readUInt32BE(16)).toBeGreaterThan(0)
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(0)
  await copyFile(output, info.outputPath('table.png'))
  await page.getByRole('dialog', { name: '表格查看' }).getByRole('button', { name: '取消' }).click()
  await desktop.restart()
  await expect(desktop.page.locator('.message-attachments img')).toHaveCount(1)
  expect(
    await desktop.page
      .locator('.message-attachments img')
      .evaluate((image: HTMLImageElement) => image.src)
  ).toBe(`data:image/png;base64,${png}`)
})

test('外部链接仅允许网页和邮件，不允许页面导航覆盖应用或启动本地协议', async ({ desktop }) => {
  await desktop.app.evaluate(({ shell }) => {
    const links: string[] = []
    ;(globalThis as unknown as { testLinks: string[] }).testLinks = links
    shell.openExternal = async (url) => {
      links.push(url)
    }
  })
  await desktop.page.evaluate(() => {
    window.open('https://example.com/docs')
    window.open('mailto:test@example.com')
    window.open('file:///C:/Windows/System32/calc.exe')
    window.open('custom-protocol:launch')
  })
  await expect
    .poll(() =>
      desktop.app.evaluate(() => (globalThis as unknown as { testLinks: string[] }).testLinks)
    )
    .toEqual(['https://example.com/docs', 'mailto:test@example.com'])
  const current = desktop.page.url()
  await desktop.page.evaluate(() => {
    window.location.href = 'https://example.com/navigation'
  })
  await expect
    .poll(() =>
      desktop.app.evaluate(
        () => (globalThis as unknown as { testLinks: string[] }).testLinks.length
      )
    )
    .toBe(3)
  expect(desktop.page.url()).toBe(current)
})

test('真实关闭保存失败可取消，重试保存后关闭并恢复刚编辑的配置', async ({ desktop, provider }) => {
  await configureThroughUI(desktop.page, provider.url)
  await desktop.app.evaluate(({ dialog }) => {
    const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
    const rename = fs.rename
    const fault = { failures: -1, dialogs: 0, response: 1 }
    ;(globalThis as unknown as { closeFault: typeof fault }).closeFault = fault
    fs.rename = async (from, to) => {
      if (String(to).endsWith('settings.json') && fault.failures !== 0) {
        if (fault.failures > 0) fault.failures--
        throw new Error('测试保存失败')
      }
      return rename(from, to)
    }
    dialog.showMessageBox = async () => {
      fault.dialogs++
      return { response: fault.response, checkboxChecked: false }
    }
  })
  await desktop.page.getByLabel('API Key').fill('edited-before-close')
  await desktop.app.evaluate(({ app }) => {
    app.quit()
  })
  await expect
    .poll(() =>
      desktop.app.evaluate(
        () => (globalThis as unknown as { closeFault: { dialogs: number } }).closeFault.dialogs
      )
    )
    .toBe(1)
  await expect(desktop.page.getByLabel('API Key')).toHaveValue('edited-before-close')
  await desktop.page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    await window.runtime.command('page.create', { name: '取消关闭后可继续工作' }, scopeId)
  })
  await desktop.app.evaluate(() => {
    const fault = (globalThis as unknown as { closeFault: { failures: number; response: number } })
      .closeFault
    fault.failures = 1
    fault.response = 0
  })
  await desktop.restart()
  const settings = await desktop.page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    return window.runtime.query('settings.get', undefined, scopeId)
  })
  expect(settings.settings.llmConfigs.items[0].apiKey).toBe('edited-before-close')
})

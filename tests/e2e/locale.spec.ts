import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, configureThroughUI } from './fixture'

test.describe('系统语言与持久化', () => {
  test.use({ systemLanguages: ['fr-FR', 'en-GB'] })

  test('首次使用英语，设置切到中文，重启后保留，仍可重新跟随系统', async ({ desktop }, info) => {
    let page = desktop.page
    const nativeLabels = (): Promise<string[]> =>
      desktop.app.evaluate(({ Menu }) => {
        const labels = (menu: Electron.Menu | null | undefined): string[] =>
          menu?.items.flatMap((item) => [item.label, ...labels(item.submenu)]) ?? []
        return labels(Menu.getApplicationMenu())
      })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    expect(await nativeLabels()).toEqual(expect.arrayContaining(['File', 'Edit', 'Undo', 'Copy']))
    await expect(page.locator('.tab-title').filter({ hasText: 'Welcome' })).toBeVisible()
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByText('Follow system (English)', { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('settings-english.png') })
    await page.getByRole('combobox', { name: 'Interface language' }).press('ArrowDown')
    await page.getByTitle('简体中文', { exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    expect(await nativeLabels()).toEqual(expect.arrayContaining(['文件', '编辑', '撤销', '复制']))
    await expect(page.getByRole('tab', { name: /通用$/ })).toBeVisible()
    await expect(page.locator('.tab-title').filter({ hasText: '设置' })).toBeVisible()
    await expect(page.locator('.tab-title').filter({ hasText: '欢迎' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('settings-chinese.png') })
    expect(JSON.parse(await readFile(join(desktop.root, 'app-preferences.json'), 'utf8'))).toEqual({
      language: 'zh-CN'
    })

    await desktop.restart()
    page = desktop.page
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.getByRole('button', { name: '设置', exact: true }).first().click()
    await page.getByRole('combobox', { name: '界面语言' }).press('ArrowDown')
    await page.getByTitle('跟随系统（English）', { exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    expect(await nativeLabels()).toEqual(expect.arrayContaining(['File', 'Edit', 'Undo', 'Copy']))
    await expect(page.getByText('Font size', { exact: true })).toBeVisible()
    expect(
      await page.evaluate(() => window.runtime.query('app.locale.get', undefined))
    ).toMatchObject({ preference: 'system', language: 'en-US' })
    // 英文设置页只允许语言选择器里的母语名称，不应残留中文界面文案。
    const text = await page.locator('.settings-editor').innerText()
    expect(text.replaceAll('简体中文', '')).not.toMatch(/\p{Script=Han}/u)
  })
})

test('生成中切换保留草稿、对话和请求，英文导出与 Monaco 菜单可用', async ({
  desktop,
  provider
}, info) => {
  test.setTimeout(120000)
  const page = desktop.page
  await configureThroughUI(page, provider.url)
  await page.keyboard.press('ControlOrMeta+n')
  await page.getByRole('textbox', { name: '消息内容' }).fill('保留中文问题 🧪')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => provider.requests.length).toBe(1)
  provider.requests[0].delta('切换前的回答')
  const conversationTitle = '保留中文问题 🧪'
  await expect(page.locator('.tab-title').filter({ hasText: conversationTitle })).toBeVisible()
  await expect(
    page.locator('.message-item__body').filter({ hasText: '切换前的回答' })
  ).toBeVisible()
  await page.getByRole('textbox', { name: '消息内容' }).fill('草稿不要改变')
  await page.getByRole('button', { name: '设置', exact: true }).first().click()
  await page.getByRole('tab', { name: /通用$/ }).click()
  await page.getByRole('combobox', { name: '界面语言' }).press('ArrowDown')
  await page.getByTitle('English', { exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await page.locator('.tab-title').filter({ hasText: conversationTitle }).click()
  await expect(page.getByRole('textbox', { name: 'Message content' })).toHaveValue('草稿不要改变')
  provider.requests[0].delta('，切换后的回答')
  provider.requests[0].finish()
  await expect(
    page.locator('.message-item__body').filter({ hasText: '切换前的回答，切换后的回答' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Stop/ })).toHaveCount(0)
  expect(provider.requests).toHaveLength(1)
  await expect(page.locator('.tab-title').filter({ hasText: conversationTitle })).toBeVisible()
  await expect(page.locator('.message-item__role').filter({ hasText: 'You' })).toBeVisible()

  await page
    .locator('.chat-editor__header')
    .getByRole('button', { name: /Export/ })
    .click()
  await page.getByRole('menuitem', { name: 'Current branch messages', exact: true }).click()
  await expect(page.getByText('Export options', { exact: true })).toBeVisible()
  await expect(page.getByText('2 messages selected', { exact: true })).toBeVisible()
  await page.getByText('Edit', { exact: true }).click()
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 20000 })
  await page.locator('.monaco-editor .view-lines').click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: /Command Palette/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: info.outputPath('export-english.png') })
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await page.getByRole('tab', { name: /General$/ }).click()
  await page.getByRole('combobox', { name: 'Interface language' }).press('ArrowDown')
  await page.getByTitle('简体中文', { exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await desktop.restart()
  await desktop.page.locator('.tab-title').filter({ hasText: conversationTitle }).click()
  await desktop.page.locator('.chat-editor__header').getByRole('button', { name: /导出/ }).click()
  await desktop.page.getByRole('menuitem', { name: '当前分支消息', exact: true }).click()
  await desktop.page.getByText('编辑', { exact: true }).click()
  await expect(desktop.page.locator('.monaco-editor')).toBeVisible({ timeout: 20000 })
  await desktop.page.locator('.monaco-editor .view-lines').click({ button: 'right' })
  await expect(desktop.page.getByRole('menuitem', { name: /命令面板/ })).toBeVisible()
  await desktop.page.keyboard.press('Escape')
})

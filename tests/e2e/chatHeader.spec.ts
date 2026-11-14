import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect, configureThroughUI } from './fixture'

async function seedConversation(page: Page, title: string): Promise<string> {
  page.setDefaultTimeout(10000)
  await page.keyboard.press('ControlOrMeta+n')
  const header = page.locator('.chat-editor__header:visible')
  await expect(header.getByRole('button', { name: '折叠全部', exact: true })).toBeDisabled()
  await expect(header.getByRole('button', { name: /导出/ })).toBeDisabled()
  const pageId = await page.evaluate(async (title) => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    const tree = await window.runtime.query('tree.get', undefined, scopeId)
    const pageId = tree.pages[0].id
    await window.runtime.command('page.update', { pageId, patch: { name: title } }, scopeId)
    await window.runtime.command(
      'conversation.replace',
      {
        pageId,
        conversation: {
          pageId,
          leafMessageId: 'answer-2',
          topics: [],
          messages: [
            { id: 'user-1', role: 'user', content: '问题一', createdAt: 1, branchIndex: 0 },
            {
              id: 'answer-1',
              parentMessageId: 'user-1',
              role: 'assistant',
              content: '回答一',
              createdAt: 2,
              branchIndex: 0
            },
            {
              id: 'user-2',
              parentMessageId: 'answer-1',
              role: 'user',
              content: '问题二',
              createdAt: 3,
              branchIndex: 0
            },
            {
              id: 'answer-2',
              parentMessageId: 'user-2',
              role: 'assistant',
              content: '当前路径回答',
              createdAt: 4,
              branchIndex: 0
            },
            {
              id: 'sibling',
              parentMessageId: 'user-2',
              role: 'assistant',
              content: '其他分支回答',
              createdAt: 5,
              branchIndex: 1
            }
          ]
        }
      },
      scopeId
    )
    return pageId
  }, title)
  return pageId
}

test('标题栏折叠菜单、键盘操作及窄窗口重命名', async ({ desktop }, info) => {
  const { page } = desktop
  const title = '会话标题栏与导出验证：一个用于检查窄窗口和重命名状态的长标题'
  const pageId = await seedConversation(page, title)
  const header = page.locator('.chat-editor__header:visible')
  const collapsedIds = async (): Promise<string[]> =>
    page.evaluate(async (pageId) => {
      const { scopeId } = await window.runtime.query('session.get', undefined)
      const record = await window.runtime.query('conversation.get', { pageId }, scopeId)
      return record.messages
        .filter((message) => message.collapsed)
        .map((message) => message.id)
        .sort()
    }, pageId)

  await expect(header.getByRole('button', { name: '折叠全部', exact: true })).toBeEnabled()
  await header.getByRole('button', { name: '折叠全部', exact: true }).click()
  await expect.poll(collapsedIds).toEqual(['answer-1', 'answer-2', 'user-1', 'user-2'])
  const more = header.getByRole('button', { name: '更多折叠操作' })
  await more.focus()
  await more.press('Enter')
  await expect(page.getByRole('menuitem', { name: '展开全部消息' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('collapse-menu.png') })
  await page.getByRole('menuitem', { name: '展开全部消息' }).press('Enter')
  await expect.poll(collapsedIds).toEqual([])
  await more.click()
  await page.getByRole('menuitem', { name: '仅折叠 AI 消息' }).click()
  await expect.poll(collapsedIds).toEqual(['answer-1', 'answer-2'])
  await header.getByRole('button', { name: '折叠全部', exact: true }).click()
  await more.click()
  await page.getByRole('menuitem', { name: '仅折叠 AI 消息' }).click()
  await expect.poll(collapsedIds).toEqual(['answer-1', 'answer-2', 'user-1', 'user-2'])

  // 使用真实窗口尺寸验证标题和操作区；恢复尺寸后进行导出。
  await desktop.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(480, 640)
  )
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await header.locator('.chat-editor__title-wrapper').hover()
  await header.locator('.chat-editor__title-edit').click()
  await expect(header.getByRole('textbox', { name: '会话标题' })).toHaveValue(title)
  const bounds = await header.evaluate((element) => {
    const header = element.getBoundingClientRect()
    const actions = element.querySelector('.chat-editor__header-actions')!.getBoundingClientRect()
    const input = element.querySelector('input')!.getBoundingClientRect()
    return {
      right: header.right,
      actionsRight: actions.right,
      actionsLeft: actions.left,
      inputRight: input.right
    }
  })
  expect(bounds.actionsRight).toBeLessThanOrEqual(bounds.right)
  expect(bounds.inputRight).toBeLessThanOrEqual(bounds.actionsLeft)
  await page.screenshot({ path: info.outputPath('header-narrow-rename.png') })
  await header.getByRole('textbox', { name: '会话标题' }).press('Escape')
})

test('固定分支导出、自由选择、多页签和实际文件保存', async ({ desktop }, info) => {
  const { page } = desktop
  const title = '会话分支导出验证'
  const pageId = await seedConversation(page, title)
  const header = page.locator('.chat-editor__header:visible')
  await desktop.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 760)
  )

  await header.getByRole('button', { name: /导出/ }).click()
  await expect(page.getByRole('menuitem')).toHaveCount(2)
  await page.screenshot({ path: info.outputPath('header-export-menu.png') })
  await page.getByRole('menuitem', { name: '当前分支消息' }).click()
  const exportPane = page.locator('.export-editor:visible')
  const exportTabs = page.getByRole('tab').filter({
    has: page.locator('.tab-title', { hasText: /^导出$/ })
  })
  await expect(exportPane.locator('.preview-panel__content')).toContainText('当前路径回答')
  await expect(exportPane.locator('.preview-panel__content')).not.toContainText('其他分支回答')
  await expect(exportPane).toContainText('已选择 4 条消息')

  await page.getByRole('tab', { name: title }).click()
  await header.getByRole('button', { name: /导出/ }).click()
  await page.getByRole('menuitem', { name: '自由选择' }).click()
  await expect(exportPane.getByRole('checkbox', { name: /^选择消息/ })).toHaveCount(4)
  await expect(exportPane.getByRole('button', { name: /导出/ })).toBeEnabled()
  await page.getByRole('tab', { name: title }).click()
  await page.evaluate(async (pageId) => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    await window.runtime.command('conversation.setLeaf', { pageId, messageId: 'sibling' }, scopeId)
  }, pageId)
  await exportTabs.last().click()
  await expect(exportPane.getByRole('checkbox', { name: '选择消息 当前路径回答' })).toBeVisible()
  await exportPane.getByRole('checkbox', { name: /^全选/ }).uncheck()
  await expect(exportPane.getByRole('button', { name: '生成预览' })).toBeDisabled()
  await expect(exportPane.getByRole('button', { name: /导出/ })).toBeDisabled()
  await exportPane.getByRole('checkbox', { name: '选择消息 当前路径回答' }).check()
  await expect(exportPane.getByRole('button', { name: /导出/ })).toBeDisabled()
  await exportPane.getByRole('button', { name: '生成预览' }).click()
  await expect(exportPane.getByRole('button', { name: /导出/ })).toBeEnabled()
  await expect(exportPane.locator('.preview-panel__content')).not.toContainText('问题一')
  await expect(exportPane.locator('.preview-panel__content')).not.toContainText('其他分支回答')

  const output = join(desktop.root, 'selected-branch.md')
  await desktop.app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output })
  }, output)
  await exportPane.getByRole('button', { name: /导出/ }).click()
  await page.getByRole('menuitem', { name: '下载文件' }).click()
  await expect.poll(async () => readFile(output, 'utf8').catch(() => '')).toContain('当前路径回答')
  const content = await readFile(output, 'utf8')
  expect(content).not.toContain('问题一')
  expect(content).not.toContain('其他分支回答')
  await page.screenshot({ path: info.outputPath('selected-export.png') })
  await exportTabs.first().click()
  await expect(exportPane).toContainText('已选择 4 条消息')
  await expect(exportPane.locator('.preview-panel__content')).toContainText('问题一')
})

test('标题栏批量折叠跳过正在生成的回答', async ({ desktop, provider }) => {
  const { page } = desktop
  await configureThroughUI(page, provider.url)
  await page.keyboard.press('ControlOrMeta+n')
  await page.getByRole('textbox', { name: '消息内容' }).fill('生成中折叠验证')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => provider.requests.length).toBe(1)
  provider.requests[0].delta('正在生成的回答')
  const header = page.locator('.chat-editor__header:visible')
  await expect(
    page.locator('.message-item__body').filter({ hasText: '正在生成的回答' })
  ).toBeVisible()
  await header.getByRole('button', { name: '折叠全部', exact: true }).click()
  await expect(
    page.locator('.message-item__body').filter({ hasText: '正在生成的回答' })
  ).toBeVisible()
  await header.getByRole('button', { name: '更多折叠操作' }).click()
  await page.getByRole('menuitem', { name: '仅折叠 AI 消息' }).click()
  await expect(
    page.locator('.message-item__body').filter({ hasText: '正在生成的回答' })
  ).toBeVisible()
  provider.requests[0].finish()
  await expect(page.getByRole('button', { name: /停止/ })).toHaveCount(0)
  await header.getByRole('button', { name: '更多折叠操作' }).click()
  await page.getByRole('menuitem', { name: '仅折叠 AI 消息' }).click()
  await expect(
    page.locator('.message-item__body').filter({ hasText: '正在生成的回答' })
  ).toHaveCount(0)
})

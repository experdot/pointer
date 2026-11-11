import { test, expect, configureThroughUI } from './fixture'

test('真实 preload 隔离、订阅取消、scope 校验和错误响应', async ({ desktop }) => {
  const { page } = desktop
  const isolation = await page.evaluate(() => ({
    node: typeof (globalThis as { require?: unknown }).require,
    process: typeof (globalThis as { process?: unknown }).process,
    runtime: Object.keys(window.runtime).sort(),
    frozen: Object.isFrozen(window.runtime)
  }))
  expect(isolation).toEqual({
    node: 'undefined',
    process: 'undefined',
    runtime: ['command', 'onFlush', 'query', 'subscribe'],
    frozen: true
  })
  const result = await page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    const events: string[] = []
    let acknowledge: () => void = () => undefined
    const notified = new Promise<void>((resolve) => {
      acknowledge = resolve
    })
    const off = window.runtime.subscribe((event) => {
      events.push(event.type)
      if (event.type === 'tree.changed') acknowledge()
    })
    await window.runtime.command('page.create', { name: '订阅页面' }, scopeId)
    await notified
    off()
    const before = events.length
    await window.runtime.command('page.create', { name: '取消订阅后' }, scopeId)
    const codes: string[] = []
    for (const action of [
      () => window.runtime.query('tree.get', undefined, 'outdated'),
      () =>
        window.runtime.command('page.update', { pageId: 'missing', patch: { name: 'x' } }, scopeId)
    ]) {
      try {
        await action()
      } catch (error) {
        codes.push((error as { code: string }).code)
      }
    }
    return { before, after: events.length, types: events, codes }
  })
  expect(result.before).toBeGreaterThan(0)
  expect(result.after).toBe(result.before)
  expect(result.types).toContain('tree.changed')
  expect(result.codes).toEqual(['runtime.stale-scope', 'page.not-found'])
})

test('界面配置、流式停止、重新生成分支、搜索和关闭后重启', async ({ desktop, provider }, info) => {
  let page = desktop.page
  await configureThroughUI(page, provider.url)
  await page.keyboard.press('ControlOrMeta+n')
  await expect(page.getByRole('textbox', { name: '消息内容' })).toBeEnabled()
  await page.getByRole('textbox', { name: '消息内容' }).fill('桌面回归 中文 🧪')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect.poll(() => provider.requests.length).toBe(1)
  expect(provider.requests[0].body.model).toBe('test-model')
  expect(provider.requests[0].body.messages.at(-1)?.content).toBe('桌面回归 中文 🧪')
  provider.requests[0].delta('第一段回答，保留这部分')
  await expect(page.locator('.message-item__body').filter({ hasText: '保留这部分' })).toBeVisible()
  await page.getByRole('button', { name: /停止/ }).click()
  await expect(page.getByRole('button', { name: /停止/ })).toHaveCount(0)
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect.poll(() => provider.requests.length).toBe(2)
  provider.requests[1].delta('重新生成的完整回答 搜索目标🧪')
  provider.requests[1].finish()
  await expect(page.locator('.message-item__body').filter({ hasText: '搜索目标🧪' })).toBeVisible()
  await expect(page.getByRole('button', { name: /停止/ })).toHaveCount(0)
  const before = await page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    const tree = await window.runtime.query('tree.get', undefined, scopeId)
    return window.runtime.query('conversation.get', { pageId: tree.pages[0].id }, scopeId)
  })
  expect(before.messages).toHaveLength(3)
  const assistants = before.messages.filter((message) => message.role === 'assistant')
  expect(assistants[0].parentMessageId).toBe(assistants[1].parentMessageId)
  expect(assistants.map((message) => message.content)).toContain('第一段回答，保留这部分')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.getByPlaceholder('搜索消息内容...').fill('搜索目标🧪')
  await page.locator('.search-result-group-header').click()
  await page.locator('.search-result-message-header').click()
  await expect(page.locator('.search-results')).toContainText('搜索目标🧪')
  await page.locator('.search-result-item').click()
  await page.keyboard.press('ControlOrMeta+f')
  await page.locator('.search-bar').getByPlaceholder('搜索...').fill('搜索目标🧪')
  await expect(page.locator('.search-bar__count')).toHaveText('1/1')
  await page.keyboard.press('Escape')
  await page.screenshot({ path: info.outputPath('chat-search.png') })
  await desktop.restart()
  page = desktop.page
  await expect(page.locator('.message-item__body').filter({ hasText: '搜索目标🧪' })).toBeVisible()
  const restored = await page.evaluate(async (id) => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    return {
      conversation: await window.runtime.query('conversation.get', { pageId: id }, scopeId),
      settings: await window.runtime.query('settings.get', undefined, scopeId)
    }
  }, before.pageId)
  expect(restored.conversation.messages).toEqual(before.messages)
  expect(restored.settings.settings.llmConfigs.items[0].baseUrl).toBe(provider.url)
  expect(restored.settings.settings.defaultLLMId).toBe(
    restored.settings.settings.llmConfigs.items[0].id
  )
})

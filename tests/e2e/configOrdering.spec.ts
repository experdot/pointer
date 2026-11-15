import { configChildren, type ConfigTree, type ConfigItemBase } from '../../src/shared/domain'
import { test, expect } from './fixture'
import type { Locator } from '@playwright/test'

for (const kind of ['llmConfigs', 'modelConfigs'] as const) {
  test(`${kind} 的真实新建、复制、拖拽与跨目录排序可以重启恢复`, async ({ desktop }) => {
    let page = desktop.page
    await page.evaluate(async (kind) => {
      const { scopeId } = await window.runtime.query('session.get', undefined)
      const snapshot = await window.runtime.query('settings.get', undefined, scopeId)
      const base = {
        kind: 'item' as const,
        createdAt: 1,
        baseUrl: 'http://localhost/v1',
        modelName: 'test',
        apiKey: '',
        systemPrompt: '',
        temperature: 0.7,
        topP: 1
      }
      snapshot.settings[kind] = {
        folders: [{ id: 'folder', name: '配置分组', kind: 'folder', createdAt: 1, orderKey: 'a1' }],
        items: [
          { ...base, id: 'a', name: '配置甲', orderKey: 'a0' },
          { ...base, id: 'b', name: '配置乙', orderKey: 'a2' }
        ]
      }
      await window.runtime.command(
        'settings.replace',
        { settings: snapshot.settings, baseRevision: snapshot.revision },
        scopeId
      )
    }, kind)
    await page.getByRole('button', { name: '设置', exact: true }).first().click()
    await page.getByRole('tab', { name: kind === 'llmConfigs' ? 'LLM 配置' : '模型配置' }).click()
    const getTree = async (): Promise<ConfigTree<ConfigItemBase>> =>
      page.evaluate(async (kind) => {
        const { scopeId } = await window.runtime.query('session.get', undefined)
        return (await window.runtime.query('settings.get', undefined, scopeId)).settings[kind]
      }, kind)
    const row = (name: string): Locator =>
      page
        .locator('.ant-tabs-tabpane-active .config-tree .ant-tree-treenode')
        .filter({ has: page.getByText(name, { exact: true }) })
    const target = row('配置甲')
    const box = (await target.boundingBox())!
    await row('配置乙')
      .locator('.tree-view-title-text')
      .dragTo(target, { targetPosition: { x: box.width / 2, y: 1 } })
    await expect
      .poll(async () => configChildren(await getTree(), undefined).map((n) => n.id))
      .toEqual(['b', 'a', 'folder'])
    expect((await getTree()).items.find((n) => n.id === 'a')!.orderKey).toBe('a0')
    expect((await getTree()).folders[0].orderKey).toBe('a1')

    await row('配置甲').locator('.tree-view-title-text').click({ button: 'right' })
    await page.getByRole('menuitem', { name: '复制为副本' }).click()
    await expect
      .poll(async () => configChildren(await getTree(), undefined).map((n) => n.name))
      .toEqual(['配置乙', '配置甲', '配置甲 副本', '配置分组'])
    const folderRow = row('配置分组')
    const folderBox = (await folderRow.boundingBox())!
    // rc-tree 依据拖动的水平偏移区分“放入”和“放在后面”，目标取行的右下区域。
    await row('配置甲')
      .locator('.tree-view-title-text')
      .dragTo(folderRow, {
        sourcePosition: { x: 2, y: 8 },
        targetPosition: { x: folderBox.width - 8, y: folderBox.height * 0.75 }
      })
    await expect
      .poll(async () => configChildren(await getTree(), 'folder').map((n) => n.id))
      .toEqual(['a'])
    await page.getByRole('button', { name: '新建配置' }).click()
    await expect.poll(async () => (await getTree()).items.length).toBe(4)
    const saved = await getTree()
    await desktop.restart()
    page = desktop.page
    expect(await getTree()).toEqual(saved)
  })
}

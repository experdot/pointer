import type { Locator, Page } from '@playwright/test'
import { childrenOf, type PageTree } from '../../src/shared/domain'
import { test, expect } from './fixture'

async function getTree(page: Page): Promise<PageTree> {
  return page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    return window.runtime.query('tree.get', undefined, scopeId)
  })
}

function row(page: Page, name: string): Locator {
  return page.locator('.explorer-tree .ant-tree-treenode').filter({
    has: page.getByText(name, { exact: true })
  })
}

function normalize(tree: PageTree): PageTree {
  return {
    folders: [...tree.folders].sort((a, b) => a.id.localeCompare(b.id)),
    pages: [...tree.pages].sort((a, b) => a.id.localeCompare(b.id))
  }
}

test('真实拖拽排序只广播最终树，跨目录移动和重启保留顺序', async ({ desktop }) => {
  let page = desktop.page
  const ids = await page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    const first = await window.runtime.command('page.create', { name: '排序页面甲' }, scopeId)
    const second = await window.runtime.command('page.create', { name: '排序页面乙' }, scopeId)
    const folder = await window.runtime.command('folder.create', { name: '排序文件夹甲' }, scopeId)
    const target = await window.runtime.command('folder.create', { name: '排序文件夹乙' }, scopeId)
    const existing = await window.runtime.command(
      'page.create',
      { name: '目标已有页面', parentFolderId: target.id },
      scopeId
    )
    return {
      first: first.id,
      second: second.id,
      folder: folder.id,
      target: target.id,
      existing: existing.id
    }
  })
  await desktop.restart()
  page = desktop.page
  const observed = await page.evaluateHandle(() => {
    const trees: PageTree[] = []
    const off = window.runtime.subscribe((event) => {
      if (event.type === 'tree.changed') trees.push(event.payload)
    })
    return { trees, off }
  })
  let eventCount = 0
  const verifyMove = async (expectedRootIds: string[]): Promise<void> => {
    await expect
      .poll(async () => childrenOf(await getTree(page), undefined).map((node) => node.id))
      .toEqual(expectedRootIds)
    eventCount += 1
    await expect.poll(() => observed.evaluate(({ trees }) => trees.length)).toBe(eventCount)
    const last = await observed.evaluate(({ trees }) => trees.at(-1)!)
    expect(normalize(last)).toEqual(normalize(await getTree(page)))
  }
  const beforeFirst = async (sourceId: string): Promise<void> => {
    const roots = childrenOf(await getTree(page), undefined)
    const source = roots.find((node) => node.id === sourceId)!
    const target = row(page, roots[0].name)
    const box = (await target.boundingBox())!
    await row(page, source.name)
      .locator('.tree-view-title-text')
      .dragTo(target, {
        targetPosition: { x: box.width / 2, y: 1 }
      })
    await verifyMove([
      sourceId,
      ...roots.filter((node) => node.id !== sourceId).map((node) => node.id)
    ])
  }
  await beforeFirst(ids.first)
  await beforeFirst(ids.folder)

  const roots = childrenOf(await getTree(page), undefined)
  const lowerTarget = row(page, '排序页面乙')
  const lowerBox = (await lowerTarget.boundingBox())!
  const expected = roots.filter((node) => node.id !== ids.folder).map((node) => node.id)
  expected.splice(expected.indexOf(ids.second) + 1, 0, ids.folder)
  await row(page, '排序文件夹甲')
    .locator('.tree-view-title-text')
    .dragTo(lowerTarget, {
      targetPosition: { x: lowerBox.width / 2, y: lowerBox.height - 1 }
    })
  await verifyMove(expected)

  const destination = row(page, '排序文件夹乙')
  const targetBox = (await destination.boundingBox())!
  await row(page, '排序页面甲')
    .locator('.tree-view-title-text')
    .dragTo(destination, {
      targetPosition: { x: targetBox.width - 45, y: targetBox.height / 2 }
    })
  await expect
    .poll(async () => childrenOf(await getTree(page), ids.target).map((node) => node.id))
    .toEqual([ids.first, ids.existing])
  await verifyMove(expected.filter((id) => id !== ids.first))
  const saved = await getTree(page)
  await observed.evaluate(({ off }) => off())
  await observed.dispose()
  await desktop.restart()
  page = desktop.page
  expect(normalize(await getTree(page))).toEqual(normalize(saved))
})

test('拖入同名位置先保持原树，确认后一次完成重命名和移动', async ({ desktop }) => {
  const { page } = desktop
  const ids = await page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    const source = await window.runtime.command('page.create', { name: '同名页面' }, scopeId)
    const folder = await window.runtime.command('folder.create', { name: '目标目录' }, scopeId)
    const existing = await window.runtime.command(
      'page.create',
      { name: '同名页面', parentFolderId: folder.id },
      scopeId
    )
    return { source: source.id, folder: folder.id, existing: existing.id }
  })
  const before = await getTree(page)
  const destination = row(page, '目标目录')
  const box = (await destination.boundingBox())!
  await row(page, '同名页面')
    .locator('.tree-view-title-text')
    .dragTo(destination, {
      targetPosition: { x: box.width - 45, y: box.height / 2 }
    })
  const dialog = page.getByRole('dialog', { name: '名称冲突' })
  await expect(dialog).toBeVisible()
  expect(await getTree(page)).toEqual(before)
  await dialog.getByRole('button', { name: '自动重命名' }).click()
  await expect(dialog).toBeHidden()
  const children = childrenOf(await getTree(page), ids.folder)
  expect(children.map((node) => node.id)).toEqual([ids.source, ids.existing])
  expect(children[0].name).not.toBe(children[1].name)
})

test('菜单移动共用重名处理，自动命名后可以移回根目录并持久化', async ({ desktop }) => {
  let page = desktop.page
  const ids = await page.evaluate(async () => {
    const { scopeId } = await window.runtime.query('session.get', undefined)
    const source = await window.runtime.command('page.create', { name: '菜单同名' }, scopeId)
    const folder = await window.runtime.command('folder.create', { name: '菜单目标' }, scopeId)
    await window.runtime.command(
      'folder.create',
      { name: '菜单同名', parentFolderId: folder.id },
      scopeId
    )
    return { source: source.id, folder: folder.id }
  })
  const chooseDestination = async (name: string, destination: string): Promise<void> => {
    await row(page, name).locator('.tree-view-title-text').click({ button: 'right' })
    await page.getByRole('menuitem', { name: '移动至...' }).click()
    const dialog = page.getByRole('dialog', { name: '移动至...' })
    await dialog.getByText(destination, { exact: true }).click()
    await dialog.getByRole('button', { name: /^移\s*动$/ }).click()
  }
  const before = await getTree(page)
  await chooseDestination('菜单同名', '菜单目标')
  const conflict = page.getByRole('dialog', { name: '名称冲突' })
  await expect(conflict).toBeVisible()
  expect(await getTree(page)).toEqual(before)
  await conflict.getByRole('button', { name: '自动重命名' }).click()
  await expect(conflict).toBeHidden()
  const moved = (await getTree(page)).pages.find((item) => item.id === ids.source)!
  expect(moved.parentFolderId).toBe(ids.folder)
  expect(moved.name).not.toBe('菜单同名')
  await row(page, '菜单目标').locator('.ant-tree-switcher').click()
  await chooseDestination(moved.name, '根目录')
  await expect
    .poll(
      async () => (await getTree(page)).pages.find((item) => item.id === ids.source)?.parentFolderId
    )
    .toBeUndefined()
  const saved = await getTree(page)
  await desktop.restart()
  page = desktop.page
  expect(normalize(await getTree(page))).toEqual(normalize(saved))
})

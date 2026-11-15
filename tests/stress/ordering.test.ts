import { expect, it } from 'vitest'
import {
  compareNodes,
  moveTreeNode,
  orderKeysBetween,
  type PageTree
} from '../../src/shared/domain'

it('一万节点的混合目录反复远距离排序，每次只替换一个节点', () => {
  const keys = orderKeysBetween(null, null, 10000)
  let tree: PageTree = { pages: [], folders: [] }
  for (let index = 0; index < keys.length; index++) {
    const node = { id: String(index), name: String(index), createdAt: index, orderKey: keys[index] }
    if (index % 3 === 0) tree.folders.push({ ...node, kind: 'folder' })
    else tree.pages.push({ ...node, kind: 'page' })
  }
  for (let step = 0; step < 100; step++) {
    const nodes = [...tree.pages, ...tree.folders].sort(compareNodes)
    const before = new Map(nodes.map((node) => [node.id, node]))
    const result = moveTreeNode(
      tree,
      { nodeId: nodes.at(-1)!.id, targetNodeId: nodes[0].id, placement: 'before' },
      step
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    tree = result.tree
    const after = [...tree.pages, ...tree.folders].sort(compareNodes)
    expect(after[0].id).toBe(nodes.at(-1)!.id)
    expect(after.filter((node) => before.get(node.id) !== node)).toHaveLength(1)
    expect(new Set(after.map((node) => node.orderKey)).size).toBe(10000)
  }
})

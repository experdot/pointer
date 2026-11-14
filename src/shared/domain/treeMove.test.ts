import { describe, expect, it } from 'vitest'
import { childrenOf, moveTreeNode, type Folder, type Page, type PageTree } from './page'
import type { TreeMove } from './common'

function folder(id: string, order = 0, parentFolderId?: string): Folder {
  return { id, name: id, kind: 'folder', order, parentFolderId, createdAt: 1 }
}

function page(id: string, order = 0, parentFolderId?: string): Page {
  return { id, name: id, kind: 'page', order, parentFolderId, createdAt: 1 }
}

function apply(tree: PageTree, move: TreeMove): PageTree {
  const result = moveTreeNode(tree, move, 100)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  return result.tree
}

describe('页面树移动意图', () => {
  const cases = (['page', 'folder', 'mixed'] as const).flatMap((kind) =>
    [undefined, 'parent'].map((parentFolderId) => ({ kind, parentFolderId }))
  )
  it.each(cases)(
    '$kind 在 $parentFolderId 下可上移、下移到末尾及插入中间',
    ({ kind, parentFolderId }) => {
      const nodes = [0, 1, 2, 3].map((order) =>
        kind === 'folder' || (kind === 'mixed' && order % 2 === 1)
          ? folder(`n${order}`, order, parentFolderId)
          : page(`n${order}`, order, parentFolderId)
      )
      let tree: PageTree = {
        folders: [
          ...(parentFolderId ? [folder(parentFolderId)] : []),
          ...nodes.filter((node): node is Folder => node.kind === 'folder')
        ],
        pages: nodes.filter((node): node is Page => node.kind === 'page')
      }
      const original = structuredClone(tree)
      tree = apply(tree, { nodeId: 'n3', targetNodeId: 'n0', placement: 'before' })
      expect(childrenOf(tree, parentFolderId).map((node) => node.id)).toEqual([
        'n3',
        'n0',
        'n1',
        'n2'
      ])
      tree = apply(tree, { nodeId: 'n3', targetNodeId: 'n2', placement: 'after' })
      expect(childrenOf(tree, parentFolderId).map((node) => node.id)).toEqual([
        'n0',
        'n1',
        'n2',
        'n3'
      ])
      tree = apply(tree, { nodeId: 'n3', targetNodeId: 'n1', placement: 'after' })
      expect(childrenOf(tree, parentFolderId).map((node) => node.id)).toEqual([
        'n0',
        'n1',
        'n3',
        'n2'
      ])
      expect(nodes).toEqual(
        [...original.pages, ...original.folders.filter((node) => node.id !== parentFolderId)].sort(
          (a, b) => a.order - b.order
        )
      )
    }
  )

  it('跨文件夹移动后仅重排源层级与目标层级，子树保持不变', () => {
    const tree = {
      folders: [folder('source'), folder('target', 1), folder('moving', 0, 'source')],
      pages: [
        page('left', 1, 'source'),
        page('a', 0, 'target'),
        page('b', 1, 'target'),
        page('child', 0, 'moving')
      ]
    }
    const moved = apply(tree, { nodeId: 'moving', targetNodeId: 'b', placement: 'before' })
    expect(childrenOf(moved, 'target').map((node) => node.id)).toEqual(['a', 'moving', 'b'])
    expect(childrenOf(moved, 'source').map((node) => node.order)).toEqual([0])
    expect(moved.pages.find((node) => node.id === 'child')).toBe(tree.pages[3])
    const first = apply(moved, { nodeId: 'moving', targetNodeId: 'target', placement: 'inside' })
    expect(childrenOf(first, 'target').map((node) => node.id)).toEqual(['moving', 'a', 'b'])
  })

  it('自身及相邻位置的无效移动保留原树引用', () => {
    const tree = {
      folders: [folder('folder')],
      pages: [page('a', 0, 'folder'), page('b', 1, 'folder')]
    }
    for (const move of [
      { nodeId: 'a', targetNodeId: 'a', placement: 'before' },
      { nodeId: 'b', targetNodeId: 'a', placement: 'after' },
      { nodeId: 'a', targetNodeId: 'b', placement: 'before' },
      { nodeId: 'a', targetNodeId: 'folder', placement: 'inside' }
    ] satisfies TreeMove[])
      expect(apply(tree, move)).toBe(tree)
  })

  it.each([
    ['missing', 'a', 'before', 'tree.node-not-found'],
    ['a', 'missing', 'after', 'tree.target-not-found'],
    ['folder', 'a', 'inside', 'tree.invalid-target'],
    ['folder', 'folder', 'inside', 'tree.cycle'],
    ['folder', 'child-folder', 'inside', 'tree.cycle'],
    ['folder', 'a', 'before', 'tree.cycle'],
    ['a', 'folder', 'invalid', 'tree.invalid-placement']
  ])('拒绝非法移动 %s → %s / %s', (nodeId, targetNodeId, placement, code) => {
    const tree = {
      folders: [folder('folder'), folder('child-folder', 0, 'folder')],
      pages: [page('a', 1, 'folder')]
    }
    const original = structuredClone(tree)
    expect(moveTreeNode(tree, { nodeId, targetNodeId, placement } as TreeMove, 100)).toMatchObject({
      ok: false,
      error: { code }
    })
    expect(tree).toEqual(original)
  })
})

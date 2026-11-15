import type { Diagnostic, TreeMove, TreeNodeBase } from './common'
import { compareNodes } from './common'
import { orderKeyBetween } from './ordering'

/** 页面树与配置树共用移动算法，结果只替换被移动的节点。 */
export function moveOrderedNode<T extends TreeNodeBase & { kind: string }>(
  nodes: readonly T[],
  move: TreeMove,
  at: number
): { ok: true; nodes: readonly T[] } | { ok: false; error: Diagnostic } {
  const fail = (code: string, message: string): { ok: false; error: Diagnostic } => ({
    ok: false,
    error: { code, message, entityId: move.nodeId }
  })
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const node = byId.get(move.nodeId)
  const target = move.targetNodeId === undefined ? undefined : byId.get(move.targetNodeId)
  if (!node) return fail('tree.node-not-found', '移动的节点已不存在')
  if (!['before', 'after', 'inside', 'end'].includes(move.placement))
    return fail('tree.invalid-placement', '无效的放置位置')
  const intoFolder = move.placement === 'inside' || move.placement === 'end'
  if (!target && (move.targetNodeId !== undefined || !intoFolder))
    return fail('tree.target-not-found', '目标节点已不存在')
  if (intoFolder && target && target.kind !== 'folder')
    return fail('tree.invalid-target', '只能移入文件夹')
  if (!intoFolder && node.id === target?.id) return { ok: true, nodes }
  const parentFolderId = intoFolder ? target?.id : target!.parentFolderId
  if (parentFolderId && byId.get(parentFolderId)?.kind !== 'folder')
    return fail('tree.target-not-found', '目标文件夹已不存在')
  if (node.kind === 'folder') {
    const visited = new Set<string>()
    for (let id = parentFolderId; id; id = byId.get(id)?.parentFolderId) {
      if (id === node.id || visited.has(id))
        return fail('tree.cycle', '不能把文件夹移入自身或其子文件夹')
      visited.add(id)
    }
  }
  const level = nodes.filter((item) => item.parentFolderId === parentFolderId).sort(compareNodes)
  const siblings = level.filter((item) => item.id !== node.id)
  const index =
    move.placement === 'inside'
      ? 0
      : move.placement === 'end'
        ? siblings.length
        : siblings.findIndex((item) => item.id === target!.id) +
          (move.placement === 'after' ? 1 : 0)
  if (
    node.parentFolderId === parentFolderId &&
    level.findIndex((item) => item.id === node.id) === index
  )
    return { ok: true, nodes }
  const orderKey = orderKeyBetween(
    siblings[index - 1]?.orderKey ?? null,
    siblings[index]?.orderKey ?? null
  )
  return {
    ok: true,
    nodes: nodes.map((item) =>
      item.id === node.id ? { ...item, parentFolderId, orderKey, updatedAt: at } : item
    )
  }
}

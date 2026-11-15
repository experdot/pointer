import { msg, LocalizedError, describe } from '@shared/i18n/message'
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import type { Diagnostic } from './common'

/** 所有树共用默认字符表；持久化键只能按字符码比较。 */
export function compareOrderKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function compareNodeIdentity(
  a: { createdAt: number; id: string },
  b: { createdAt: number; id: string }
): number {
  return a.createdAt - b.createdAt || compareOrderKeys(a.id, b.id)
}

export function isOrderKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z][0-9A-Za-z]+$/.test(value)) return false
  try {
    generateKeyBetween(value, null)
    return true
  } catch {
    return false
  }
}

export function assertOrderKey(value: unknown): asserts value is string {
  if (!isOrderKey(value)) throw new LocalizedError(msg('errors.order.invalid'))
}

export function orderKeysBetween(
  left: string | null,
  right: string | null,
  count: number
): string[] {
  if (left !== null) assertOrderKey(left)
  if (right !== null) assertOrderKey(right)
  if (left !== null && right !== null && left >= right)
    throw new LocalizedError(msg('errors.order.bounds'))
  if (!Number.isSafeInteger(count) || count < 0) throw new LocalizedError(msg('errors.order.count'))
  return generateNKeysBetween(left, right, count)
}

export function orderKeyBetween(left: string | null, right: string | null): string {
  return orderKeysBetween(left, right, 1)[0]
}

interface OrderedNode {
  id: string
  parentFolderId?: string
  orderKey: string
  createdAt: number
}

export function validateOrderKeys(nodes: readonly OrderedNode[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const seen = new Map<string | undefined, Set<string>>()
  for (const node of nodes) {
    if (!isOrderKey(node.orderKey)) {
      diagnostics.push({
        code: 'tree.invalid-order-key',
        ...describe('errors.order.nodeMissingKey'),
        entityId: node.id
      })
      continue
    }
    const keys = seen.get(node.parentFolderId) ?? new Set<string>()
    if (keys.has(node.orderKey))
      diagnostics.push({
        code: 'tree.duplicate-order-key',
        ...describe('errors.tree.duplicateOrder'),
        entityId: node.id
      })
    keys.add(node.orderKey)
    seen.set(node.parentFolderId, keys)
  }
  return diagnostics
}

/** 外部合入的重复键只修复重复组，保留组内第一个节点和所有其他节点的键。 */
export function repairDuplicateOrderKeys(nodes: readonly OrderedNode[]): Map<string, string> {
  const levels = new Map<string | undefined, OrderedNode[]>()
  for (const node of nodes) {
    assertOrderKey(node.orderKey)
    const level = levels.get(node.parentFolderId) ?? []
    level.push(node)
    levels.set(node.parentFolderId, level)
  }
  const changed = new Map<string, string>()
  for (const level of levels.values()) {
    level.sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey) || compareNodeIdentity(a, b))
    for (let start = 0; start < level.length; ) {
      let end = start + 1
      while (end < level.length && level[end].orderKey === level[start].orderKey) end++
      if (end - start > 1) {
        const keys = orderKeysBetween(
          level[start].orderKey,
          level[end]?.orderKey ?? null,
          end - start - 1
        )
        for (let index = start + 1; index < end; index++)
          changed.set(level[index].id, keys[index - start - 1])
      }
      start = end
    }
  }
  return changed
}

import { describe, expect, it } from 'vitest'
import {
  assertOrderKey,
  compareOrderKeys,
  isOrderKey,
  orderKeyBetween,
  orderKeysBetween,
  repairDuplicateOrderKeys,
  validateOrderKeys
} from './ordering'
import { compareNodes } from './common'
import {
  configChildren,
  configInsertPosition,
  moveConfigNode,
  type ConfigTree,
  type ConfigItemBase
} from './configTree'

const item = (id: string, orderKey: string, parentFolderId?: string): ConfigItemBase => ({
  id,
  kind: 'item',
  name: id,
  createdAt: 1,
  orderKey,
  parentFolderId
})

describe('默认格式的可变长排序键', () => {
  it('空目录、头尾、中间和批量插入', () => {
    expect(orderKeyBetween(null, null)).toBe('a0')
    expect(orderKeysBetween(null, null, 3)).toEqual(['a0', 'a1', 'a2'])
    const keys = [
      orderKeyBetween(null, 'a0'),
      'a0',
      ...orderKeysBetween('a0', 'a1', 20),
      'a1',
      orderKeyBetween('a1', null)
    ]
    expect(keys.every(isOrderKey)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.toSorted(compareOrderKeys)).toEqual(keys)
    expect(orderKeysBetween(null, null, 0)).toEqual([])
    expect(compareOrderKeys('a0Z', 'a0a')).toBe(-1)
    expect(compareOrderKeys('a0a', 'a0Z')).toBe(1)
    expect(compareOrderKeys('a0', 'a0')).toBe(0)
  })

  it.each([undefined, null, 0, '', 'a', 'b0', 'a00', 'a0!', '0a', 'A00000000000000000000000000'])(
    '拒绝非法键 %s',
    (value) => {
      expect(isOrderKey(value)).toBe(false)
      expect(() => assertOrderKey(value)).toThrow()
    }
  )

  it('拒绝倒置、重复边界和无效批量大小', () => {
    for (const count of [-1, 0.5, Infinity])
      expect(() => orderKeysBetween(null, null, count)).toThrow()
    expect(() => orderKeyBetween('a0', 'a0')).toThrow()
    expect(() => orderKeyBetween('a1', 'a0')).toThrow()
    expect(() => orderKeyBetween('invalid!', null)).toThrow()
    expect(() => orderKeyBetween(null, 'invalid!')).toThrow()
  })

  it('向同一狭窄间隙连续插入一万次，不丢失精度也不改变两端', () => {
    const left = 'a0'
    let right = 'a1'
    const keys = new Set<string>()
    for (let index = 0; index < 10000; index++) {
      const key = orderKeyBetween(left, right)
      expect(left < key && key < right).toBe(true)
      keys.add(key)
      right = key
    }
    expect(keys.size).toBe(10000)
    expect(isOrderKey(right)).toBe(true)
    expect(right.length).toBeGreaterThan(100)
  })

  it('重复组按创建时间和 ID 稳定排序，仅修复组内后续节点', () => {
    const nodes = [
      item('b', 'a0'),
      item('a', 'a0'),
      { ...item('early', 'a0'), createdAt: 0 },
      item('next', 'a1'),
      item('other', 'a0', 'folder')
    ]
    expect(validateOrderKeys(nodes).map((d) => d.code)).toEqual([
      'tree.duplicate-order-key',
      'tree.duplicate-order-key'
    ])
    const fixes = repairDuplicateOrderKeys(nodes)
    expect([...fixes.keys()]).toEqual(['a', 'b'])
    const repaired = nodes.map((node) => ({
      ...node,
      orderKey: fixes.get(node.id) ?? node.orderKey
    }))
    expect(validateOrderKeys(repaired)).toEqual([])
    expect(
      repaired
        .filter((n) => !n.parentFolderId)
        .sort(compareNodes)
        .map((n) => n.id)
    ).toEqual(['early', 'a', 'b', 'next'])
    expect(repairDuplicateOrderKeys(repaired).size).toBe(0)
    expect(validateOrderKeys([item('invalid', '')])[0].code).toBe('tree.invalid-order-key')
    expect(() => repairDuplicateOrderKeys([item('invalid', '')])).toThrow()
    expect(repairDuplicateOrderKeys([item('b', 'a0'), item('a', 'a0')]).get('b')).toBe('a1')
  })
})

describe('配置插入和移动意图', () => {
  const tree: ConfigTree<ConfigItemBase> = {
    folders: [{ ...item('folder', 'a1'), kind: 'folder' }],
    items: [item('a', 'a0'), item('b', 'a2')]
  }
  it('在混合节点之间、指定文件夹和末尾创建', () => {
    const between = configInsertPosition(tree, { afterNodeId: 'a' })
    expect('a0' < between.orderKey && between.orderKey < 'a1').toBe(true)
    expect(configInsertPosition(tree, {})).toEqual({ parentFolderId: undefined, orderKey: 'a3' })
    expect(configInsertPosition(tree, { parentFolderId: 'folder' })).toEqual({
      parentFolderId: 'folder',
      orderKey: 'a0'
    })
    expect(() => configInsertPosition(tree, { afterNodeId: 'missing' })).toThrow()
    expect(() => configInsertPosition(tree, { parentFolderId: 'missing' })).toThrow()
  })
  it('跨目录只修改移动节点，无操作保留原引用，非法目标明确拒绝', () => {
    const result = moveConfigNode(
      tree,
      { nodeId: 'a', targetNodeId: 'folder', placement: 'inside' },
      9
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(configChildren(result.tree, 'folder').map((n) => n.id)).toEqual(['a'])
    expect(result.tree.folders[0]).toBe(tree.folders[0])
    expect(result.tree.items[1]).toBe(tree.items[1])
    expect(
      moveConfigNode(result.tree, { nodeId: 'a', targetNodeId: 'folder', placement: 'end' }, 10)
    ).toEqual({ ok: true, tree: result.tree })
    const noop = moveConfigNode(
      tree,
      { nodeId: 'a', targetNodeId: 'folder', placement: 'before' },
      10
    )
    if (noop.ok) expect(noop.tree).toBe(tree)
    expect(
      moveConfigNode(tree, { nodeId: 'a', targetNodeId: 'missing', placement: 'after' }, 9).ok
    ).toBe(false)
  })
})

/**
 * 领域层通用类型
 *
 * 约束：本目录只允许纯 TypeScript，不依赖 Electron、Node IO、React 或任何 store。
 * 函数保持纯函数或接收显式时间戳，方便在任意进程与测试中复用。
 */

/** 带创建/更新时间戳的实体 */
export interface Timestamps {
  createdAt: number
  updatedAt?: number
}

/** 树形实体基础字段（页面与文件夹共用） */
export interface TreeNodeBase extends Timestamps {
  id: string
  name: string
  parentFolderId?: string
  order: number
}

/** inside/end 表示移入目录首位/末尾；省略目标表示工作区根目录。 */
export type TreeMove = { nodeId: string } & (
  | { targetNodeId: string; placement: 'before' | 'after' }
  | { targetNodeId?: string; placement: 'inside' | 'end' }
)

/** 不变量校验结果 */
export interface Diagnostic {
  code: string
  message: string
  entityId?: string
}

/** 文件夹的全部后代 id（不含自身）；visited 守卫保证成环数据也能终止。 */
export function descendantFolderIds(
  tree: { folders: readonly Pick<TreeNodeBase, 'id' | 'parentFolderId'>[] },
  folderId: string
): string[] {
  const result: string[] = []
  const visited = new Set<string>([folderId])
  const stack = [folderId]
  const children = new Map<string | undefined, string[]>()
  for (const folder of tree.folders) {
    const siblings = children.get(folder.parentFolderId) ?? []
    siblings.push(folder.id)
    children.set(folder.parentFolderId, siblings)
  }

  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const id of children.get(current) ?? []) {
      if (visited.has(id)) continue
      visited.add(id)
      result.push(id)
      stack.push(id)
    }
  }

  return result
}

/** 同级节点排序：order、创建时间、id 依次比较，保证结果确定 */
export function compareNodes(
  a: { order: number; createdAt: number; id: string },
  b: { order: number; createdAt: number; id: string }
): number {
  if (a.order !== b.order) return a.order - b.order
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** 名称比较键：文件名与显示名称在各平台与大小写下的归一化形式 */
export function nameKey(name: string): string {
  return name.normalize('NFC').trim().toLowerCase()
}

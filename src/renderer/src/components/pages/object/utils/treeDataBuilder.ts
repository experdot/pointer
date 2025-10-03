import { ObjectNode } from '../../../../types/type'

interface TreeNode {
  title: string
  value: string
  key: string
  children: TreeNode[]
}

export const buildTreeData = (
  nodes: Record<string, ObjectNode>,
  rootNodeId: string | undefined
): TreeNode[] => {
  const treeData: TreeNode[] = []

  const buildNode = (nodeId: string): TreeNode | null => {
    const node = nodes[nodeId]
    if (!node) return null

    return {
      title: node.name,
      value: nodeId,
      key: nodeId,
      children: node.children?.map((childId) => buildNode(childId)).filter(Boolean) as TreeNode[] || []
    }
  }

  if (rootNodeId) {
    const rootNode = buildNode(rootNodeId)
    if (rootNode) {
      treeData.push(rootNode)
    }
  }

  return treeData
}

export const validateObjectData = (data: any): boolean => {
  if (!data || typeof data !== 'object') {
    return false
  }

  // 检查必需的字段
  if (!data.nodes || typeof data.nodes !== 'object') {
    return false
  }

  if (!data.rootNodeId || typeof data.rootNodeId !== 'string') {
    return false
  }

  return true
}

export const validateNodeStructure = (node: any): boolean => {
  if (!node || typeof node !== 'object') {
    return false
  }

  // 检查节点必需字段
  const requiredFields = ['id', 'name', 'type']
  for (const field of requiredFields) {
    if (!(field in node)) {
      return false
    }
  }

  return true
}

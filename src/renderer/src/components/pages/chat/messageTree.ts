import { ChatMessage } from '../../../types/type'

export interface MessageTreeNode {
  message: ChatMessage
  children: MessageTreeNode[]
  parent?: MessageTreeNode
}

export class MessageTree {
  private messageMap: Map<string, ChatMessage> = new Map()
  private root: MessageTreeNode | null = null
  private currentPath: string[] = []

  constructor(messages: ChatMessage[] = []) {
    this.buildFromMessages(messages)
  }

  /**
   * 从消息列表构建消息树
   */
  buildFromMessages(messages: ChatMessage[]) {
    this.messageMap.clear()
    this.root = null
    this.currentPath = []

    // 如果没有消息，返回
    if (messages.length === 0) return

    // 将消息按时间排序
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp)

    // 构建消息映射，确保每个消息都有children数组
    sortedMessages.forEach((msg) => {
      const messageWithChildren = {
        ...msg,
        children: msg.children || []
      }
      this.messageMap.set(msg.id, messageWithChildren)
    })

    // 构建树结构并确保父子关系正确
    const nodeMap = new Map<string, MessageTreeNode>()
    const rootNodes: MessageTreeNode[] = []

    sortedMessages.forEach((msg) => {
      const messageWithChildren = this.messageMap.get(msg.id)!
      const node: MessageTreeNode = {
        message: messageWithChildren,
        children: [],
        parent: undefined
      }
      nodeMap.set(msg.id, node)

      if (!msg.parentId) {
        // 根节点 - 支持多个根节点
        rootNodes.push(node)
        if (!this.root) {
          this.root = node
        }
      } else {
        // 子节点
        const parentNode = nodeMap.get(msg.parentId)
        if (parentNode) {
          node.parent = parentNode
          parentNode.children.push(node)

          // 确保父消息的children数组包含当前消息ID
          const parentMessage = this.messageMap.get(msg.parentId)!
          if (!parentMessage.children.includes(msg.id)) {
            parentMessage.children = [...parentMessage.children, msg.id]
            this.messageMap.set(msg.parentId, parentMessage)
          }
        }
      }
    })

    // 设置默认路径（从根到最新的叶子节点）
    this.setDefaultPath()
  }

  /**
   * 设置默认路径（选择最新的分支）
   */
  private setDefaultPath() {
    if (!this.root) return

    const path: string[] = []
    let currentNode = this.root

    while (currentNode) {
      path.push(currentNode.message.id)

      // 选择最新的子节点（时间戳最大的）
      if (currentNode.children.length > 0) {
        currentNode = currentNode.children.reduce((latest, child) =>
          child.message.timestamp > latest.message.timestamp ? child : latest
        )
      } else {
        break
      }
    }

    this.currentPath = path
  }

  /**
   * 获取当前路径的消息列表（用于显示）
   */
  getCurrentPathMessages(): ChatMessage[] {
    return this.currentPath.map((id) => this.messageMap.get(id)).filter(Boolean) as ChatMessage[]
  }

  /**
   * 获取指定消息的兄弟分支信息
   */
  getSiblingBranches(messageId: string): { siblings: ChatMessage[]; currentIndex: number } {
    const message = this.messageMap.get(messageId)
    if (!message) {
      return { siblings: [], currentIndex: 0 }
    }

    if (!message.parentId) {
      // 根节点，查找所有没有父消息的消息作为兄弟分支
      const rootMessages = Array.from(this.messageMap.values())
        .filter((msg) => !msg.parentId || msg.parentId === null)
        .sort((a, b) => a.timestamp - b.timestamp)

      const currentIndex = rootMessages.findIndex((msg) => msg.id === messageId)
      return { siblings: rootMessages, currentIndex: currentIndex >= 0 ? currentIndex : 0 }
    }

    const parentMessage = this.messageMap.get(message.parentId)
    if (!parentMessage || !parentMessage.children) {
      return { siblings: [message], currentIndex: 0 }
    }

    const siblings = parentMessage.children
      .map((id) => this.messageMap.get(id))
      .filter(Boolean) as ChatMessage[]
    const currentIndex = siblings.findIndex((msg) => msg.id === messageId)

    return { siblings, currentIndex: currentIndex >= 0 ? currentIndex : 0 }
  }

  /**
   * 切换到指定的子分支
   */
  switchToChildBranch(parentMessageId: string, childBranchIndex: number): string[] {
    const { children } = this.getChildBranches(parentMessageId)
    if (childBranchIndex < 0 || childBranchIndex >= children.length) {
      return this.currentPath
    }

    const targetChild = children[childBranchIndex]
    const parentIndex = this.currentPath.indexOf(parentMessageId)

    if (parentIndex === -1) {
      return this.currentPath
    }

    // 构建新路径：保留到父节点的路径，然后添加选中的子分支路径
    const newPath = [...this.currentPath.slice(0, parentIndex + 1), targetChild.id]

    // 继续沿着这个分支向下，选择最新的子分支
    let currentMessage = targetChild
    while (currentMessage.children && currentMessage.children.length > 0) {
      const childId = currentMessage.children.reduce((latest, childId) => {
        const child = this.messageMap.get(childId)
        const latestChild = this.messageMap.get(latest)
        return child && latestChild && child.timestamp > latestChild.timestamp ? childId : latest
      })

      const childMessage = this.messageMap.get(childId)
      if (childMessage) {
        newPath.push(childMessage.id)
        currentMessage = childMessage
      } else {
        break
      }
    }

    this.currentPath = newPath
    return newPath
  }

  /**
   * 添加消息到指定父消息下
   */
  addMessage(message: ChatMessage, parentId?: string): string[] {
    // 更新消息对象，确保包含正确的parentId和children
    const messageWithParent = {
      ...message,
      parentId,
      children: message.children || []
    }

    this.messageMap.set(message.id, messageWithParent)

    if (!parentId) {
      // 如果没有父ID，作为根消息
      if (!this.root) {
        // 第一个根消息
        const node: MessageTreeNode = {
          message: messageWithParent,
          children: [],
          parent: undefined
        }
        this.root = node
        this.currentPath = [message.id]
      } else {
        // 已经有根消息，新添加的根消息作为兄弟分支
        // 切换到新添加的根消息分支
        this.currentPath = [message.id]
      }
    } else {
      // 添加为子消息
      const parentMessage = this.messageMap.get(parentId)
      if (parentMessage) {
        // 更新父消息的子节点列表
        const updatedParent = {
          ...parentMessage,
          children: [...(parentMessage.children || []), message.id]
        }
        this.messageMap.set(parentId, updatedParent)

        // 更新当前路径：添加到父节点之后
        const parentIndex = this.currentPath.indexOf(parentId)
        if (parentIndex !== -1) {
          this.currentPath = [...this.currentPath.slice(0, parentIndex + 1), message.id]
        } else {
          // 如果父节点不在当前路径中，直接添加到路径末尾
          this.currentPath.push(message.id)
        }
      }
    }

    return this.currentPath
  }

  /**
   * 获取当前路径
   */
  getCurrentPath(): string[] {
    return [...this.currentPath]
  }

  /**
   * 设置当前路径
   */
  setCurrentPath(path: string[]): void {
    this.currentPath = [...path]
  }

  /**
   * 获取所有消息
   */
  getAllMessages(): ChatMessage[] {
    return Array.from(this.messageMap.values())
  }

  /**
   * 检查消息是否有多个子分支
   */
  hasChildBranches(messageId: string): boolean {
    const message = this.messageMap.get(messageId)
    if (!message || !message.children) return false
    return message.children.length > 1
  }

  /**
   * 获取消息的子分支信息
   */
  getChildBranches(messageId: string): { children: ChatMessage[]; currentIndex: number } {
    const message = this.messageMap.get(messageId)
    if (!message || !message.children) {
      return { children: [], currentIndex: 0 }
    }

    const children = message.children
      .map((id) => this.messageMap.get(id))
      .filter(Boolean) as ChatMessage[]

    // 找到当前路径中的子节点索引
    const currentChildId = this.currentPath[this.currentPath.indexOf(messageId) + 1]
    const currentIndex = currentChildId
      ? children.findIndex((child) => child.id === currentChildId)
      : 0

    return { children, currentIndex: Math.max(0, currentIndex) }
  }

  /**
   * 获取当前选中的子分支索引
   */
  getCurrentChildBranchIndex(messageId: string): number {
    const { currentIndex } = this.getChildBranches(messageId)
    return currentIndex
  }

  /**
   * 获取子分支的总数
   */
  getChildBranchCount(messageId: string): number {
    const { children } = this.getChildBranches(messageId)
    return children.length
  }

  /**
   * 检查消息是否有多个兄弟分支
   */
  hasSiblingBranches(messageId: string): boolean {
    const { siblings } = this.getSiblingBranches(messageId)
    return siblings.length > 1
  }

  /**
   * 获取当前选中的兄弟分支索引
   */
  getCurrentSiblingBranchIndex(messageId: string): number {
    const { currentIndex } = this.getSiblingBranches(messageId)
    return currentIndex
  }

  /**
   * 获取兄弟分支的总数
   */
  getSiblingBranchCount(messageId: string): number {
    const { siblings } = this.getSiblingBranches(messageId)
    return siblings.length
  }

  /**
   * 切换到指定的兄弟分支
   */
  switchToSiblingBranch(messageId: string, siblingBranchIndex: number): string[] {
    const { siblings } = this.getSiblingBranches(messageId)

    if (siblingBranchIndex < 0 || siblingBranchIndex >= siblings.length) {
      return this.currentPath
    }

    const targetSibling = siblings[siblingBranchIndex]
    const sourceMessage = this.messageMap.get(messageId)

    if (!sourceMessage) {
      return this.currentPath
    }

    // 构建从根到目标兄弟消息的路径
    const pathToParent: string[] = []
    let currentMsg: ChatMessage | undefined = sourceMessage.parentId
      ? this.messageMap.get(sourceMessage.parentId)
      : undefined

    // 从父消息回溯到根
    while (currentMsg) {
      pathToParent.unshift(currentMsg.id)
      currentMsg = currentMsg.parentId ? this.messageMap.get(currentMsg.parentId) : undefined
    }

    // 新路径 = 到父节点的路径 + 目标兄弟节点
    const newPath = [...pathToParent, targetSibling.id]

    // 继续沿着这个分支向下，选择最新的子分支
    let currentMessage = targetSibling
    while (currentMessage.children && currentMessage.children.length > 0) {
      const childId = currentMessage.children.reduce((latest, childId) => {
        const child = this.messageMap.get(childId)
        const latestChild = this.messageMap.get(latest)
        return child && latestChild && child.timestamp > latestChild.timestamp ? childId : latest
      })

      const childMessage = this.messageMap.get(childId)
      if (childMessage) {
        newPath.push(childMessage.id)
        currentMessage = childMessage
      } else {
        break
      }
    }

    this.currentPath = newPath
    return newPath
  }
}

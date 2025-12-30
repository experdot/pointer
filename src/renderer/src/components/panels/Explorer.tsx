import React, { useState, useMemo } from 'react'
import { Flex, Button, Input, Empty, Tree, Dropdown } from 'antd'
import type { TreeDataNode, TreeProps, MenuProps } from 'antd'
import {
  PlusOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { usePages } from '../../hooks/usePages'
import { useTabsStore } from '../../stores/tabsStore'
import { useConfirmDialog } from '../common/ConfirmDialog'
import type { ChatPage, PageFolder } from '../../types/type'
import './Explorer.css'

interface TreeNodeData extends TreeDataNode {
  isFolder: boolean
  data: ChatPage | PageFolder
}

// 辅助函数：从 TreeDataNode 获取自定义数据
function getTreeNodeData(node: TreeDataNode): TreeNodeData | null {
  // 检查是否有我们添加的自定义属性
  if ('isFolder' in node && 'data' in node) {
    return node as TreeNodeData
  }
  return null
}

export function Explorer(): React.JSX.Element {
  const {
    pages,
    folders,
    rootItems,
    getItemsInFolder,
    createPage,
    deletePage,
    updatePage,
    createFolder,
    deleteFolder,
    updateFolder,
    toggleFolderExpanded,
    openPage,
    movePage
  } = usePages()

  const { showDeleteConfirm } = useConfirmDialog()

  // 获取当前激活 tab 对应的 pageId
  const { tabs, activeTabId } = useTabsStore()
  const activePageId = tabs.find((t) => t.id === activeTabId)?.pageId

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // 构建树数据
  const treeData = useMemo(() => {
    const buildFolderNode = (folder: PageFolder): TreeNodeData => {
      const itemsInFolder = getItemsInFolder(folder.id)

      return {
        key: folder.id,
        title: folder.name,
        isFolder: true,
        data: folder,
        icon: folder.expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
        children: itemsInFolder.map((item) =>
          'data' in item ? buildPageNode(item as ChatPage) : buildFolderNode(item as PageFolder)
        )
      }
    }

    const buildPageNode = (page: ChatPage): TreeNodeData => ({
      key: page.id,
      title: page.title,
      isFolder: false,
      data: page,
      icon: <MessageOutlined />,
      isLeaf: true
    })

    return rootItems.map((item) =>
      'data' in item ? buildPageNode(item as ChatPage) : buildFolderNode(item as PageFolder)
    )
  }, [folders, pages, rootItems, getItemsInFolder])

  // 展开的文件夹
  const expandedKeys = useMemo(
    () => folders.filter((f) => f.expanded).map((f) => f.id),
    [folders]
  )

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id)
    setEditingValue(currentName)
  }

  const handleFinishRename = (isFolder: boolean) => {
    if (editingId && editingValue.trim()) {
      if (isFolder) {
        updateFolder(editingId, { name: editingValue.trim() })
      } else {
        updatePage(editingId, { title: editingValue.trim() })
      }
    }
    setEditingId(null)
    setEditingValue('')
  }

  const handleDeletePage = (page: ChatPage) => {
    showDeleteConfirm({
      title: `删除 "${page.title}"`,
      onOk: () => deletePage(page.id)
    })
  }

  const handleDeleteFolder = (folder: PageFolder) => {
    showDeleteConfirm({
      title: `删除文件夹 "${folder.name}"`,
      content: '文件夹内的对话将移动到根目录',
      onOk: () => deleteFolder(folder.id)
    })
  }

  const handleExpand: TreeProps['onExpand'] = (keys) => {
    // 找出新展开和新折叠的
    const newExpanded = keys.filter((k) => !expandedKeys.includes(k as string))
    const newCollapsed = expandedKeys.filter((k) => !keys.includes(k))

    newExpanded.forEach((id) => toggleFolderExpanded(id as string))
    newCollapsed.forEach((id) => toggleFolderExpanded(id as string))
  }

  const handleDrop: TreeProps['onDrop'] = (info) => {
    const dragKey = info.dragNode.key as string
    const dropKey = info.node.key as string
    const dropNodeData = getTreeNodeData(info.node as TreeDataNode)

    // 检查是否是页面拖拽
    const draggedPage = pages.find((p) => p.id === dragKey)
    const draggedFolder = folders.find((f) => f.id === dragKey)

    if (draggedPage) {
      // 页面拖拽
      if (dropNodeData?.isFolder && !info.dropToGap) {
        // 拖到文件夹内部（不是间隙），放到第一个位置
        const targetFolderId = dropKey

        // 获取目标文件夹内的所有项目
        const itemsInFolder = [
          ...pages.filter((p) => p.parentFolderId === targetFolderId && p.id !== dragKey),
          ...folders.filter((f) => f.parentFolderId === targetFolderId)
        ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

        // 在开头插入被拖拽的页面
        const newItems = [draggedPage, ...itemsInFolder]

        // 批量更新 order 和 parentFolderId
        newItems.forEach((item, index) => {
          if ('data' in item) {
            updatePage(item.id, {
              order: index,
              parentFolderId: targetFolderId
            })
          } else {
            updateFolder(item.id, {
              order: index,
              parentFolderId: targetFolderId
            })
          }
        })
      } else if (info.dropToGap) {
        // 拖到间隙（同级位置），需要重新计算 order
        const targetPage = pages.find((p) => p.id === dropKey)
        const targetFolder = folders.find((f) => f.id === dropKey)
        const targetParentFolderId = targetPage?.parentFolderId ?? targetFolder?.parentFolderId

        // 获取目标层级的所有项目（文件夹和页面混合）
        const sameLevelItems = [
          ...pages.filter((p) => p.parentFolderId === targetParentFolderId),
          ...folders.filter((f) => f.parentFolderId === targetParentFolderId)
        ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

        // 移除被拖拽的页面
        const withoutDragged = sameLevelItems.filter((item) => item.id !== dragKey)

        // 找到目标的索引
        const targetIndex = withoutDragged.findIndex((item) => item.id === dropKey)

        // 判断是放在目标前面还是后面
        const dropPos = info.dropPosition
        const targetPos = Number(info.node.pos.split('-').pop())
        const insertIndex = dropPos > targetPos ? targetIndex + 1 : targetIndex

        // 在新位置插入被拖拽的页面
        withoutDragged.splice(insertIndex, 0, draggedPage)

        // 批量更新 order 和 parentFolderId
        withoutDragged.forEach((item, index) => {
          if ('data' in item) {
            // 是页面
            updatePage(item.id, {
              order: index,
              parentFolderId: targetParentFolderId
            })
          } else {
            // 是文件夹
            updateFolder(item.id, {
              order: index,
              parentFolderId: targetParentFolderId
            })
          }
        })
      }
    } else if (draggedFolder) {
      // 文件夹拖拽
      if (dropNodeData?.isFolder && !info.dropToGap) {
        // 拖到另一个文件夹内部，放到第一个位置
        const targetFolderId = dropKey

        // 获取目标文件夹内的所有项目
        const itemsInFolder = [
          ...pages.filter((p) => p.parentFolderId === targetFolderId),
          ...folders.filter((f) => f.parentFolderId === targetFolderId && f.id !== dragKey)
        ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

        // 在开头插入被拖拽的文件夹
        const newItems = [draggedFolder, ...itemsInFolder]

        // 批量更新 order 和 parentFolderId
        newItems.forEach((item, index) => {
          if ('data' in item) {
            updatePage(item.id, {
              order: index,
              parentFolderId: targetFolderId
            })
          } else {
            updateFolder(item.id, {
              order: index,
              parentFolderId: targetFolderId
            })
          }
        })
      } else if (info.dropToGap) {
        // 拖到间隙（同级位置），需要重新计算 order
        const targetPage = pages.find((p) => p.id === dropKey)
        const targetFolder = folders.find((f) => f.id === dropKey)
        const targetParentFolderId = targetPage?.parentFolderId ?? targetFolder?.parentFolderId

        // 获取目标层级的所有项目（文件夹和页面混合）
        const sameLevelItems = [
          ...pages.filter((p) => p.parentFolderId === targetParentFolderId),
          ...folders.filter((f) => f.parentFolderId === targetParentFolderId)
        ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

        // 移除被拖拽的文件夹
        const withoutDragged = sameLevelItems.filter((item) => item.id !== dragKey)

        // 找到目标的索引
        const targetIndex = withoutDragged.findIndex((item) => item.id === dropKey)

        // 判断是放在目标前面还是后面
        const dropPos = info.dropPosition
        const targetPos = Number(info.node.pos.split('-').pop())
        const insertIndex = dropPos > targetPos ? targetIndex + 1 : targetIndex

        // 在新位置插入被拖拽的文件夹
        withoutDragged.splice(insertIndex, 0, draggedFolder)

        // 批量更新 order 和 parentFolderId
        withoutDragged.forEach((item, index) => {
          if ('data' in item) {
            // 是页面
            updatePage(item.id, {
              order: index,
              parentFolderId: targetParentFolderId
            })
          } else {
            // 是文件夹
            updateFolder(item.id, {
              order: index,
              parentFolderId: targetParentFolderId
            })
          }
        })
      }
    }
  }

  // 控制拖拽放置规则
  const handleAllowDrop: TreeProps['allowDrop'] = ({ dropNode, dropPosition }) => {
    const dropNodeData = getTreeNodeData(dropNode as TreeDataNode)

    // 如果目标是页面（叶子节点），只允许放在上方或下方（gap），不允许放在内部
    if (dropNodeData && !dropNodeData.isFolder) {
      return dropPosition !== 0
    }

    return true
  }

  // 单击选中处理
  const handleSelect: TreeProps['onSelect'] = (_selectedKeys, info) => {
    const nodeData = getTreeNodeData(info.node as TreeDataNode)
    if (nodeData) {
      if (nodeData.isFolder) {
        // 文件夹：切换展开/收起
        toggleFolderExpanded(info.node.key as string)
      } else {
        // 页面：打开
        openPage(info.node.key as string)
      }
    }
  }

  // 右键菜单项
  const getContextMenuItems = (node: TreeNodeData): MenuProps['items'] => {
    if (node.isFolder) {
      const folder = node.data as PageFolder
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => handleStartRename(folder.id, folder.name)
        },
        { type: 'divider' },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => handleDeleteFolder(folder)
        }
      ]
    } else {
      const page = node.data as ChatPage
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => handleStartRename(page.id, page.title)
        },
        { type: 'divider' },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => handleDeletePage(page)
        }
      ]
    }
  }

  // 自定义标题渲染
  const titleRender = (node: TreeDataNode) => {
    const treeNode = getTreeNodeData(node)
    if (!treeNode) return null

    const id = node.key as string
    const title = node.title as string

    if (editingId === id) {
      return (
        <Input
          size="small"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => handleFinishRename(treeNode.isFolder)}
          onPressEnter={() => handleFinishRename(treeNode.isFolder)}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          style={{ width: 120 }}
        />
      )
    }

    return (
      <Dropdown
        menu={{ items: getContextMenuItems(treeNode) }}
        trigger={['contextMenu']}
      >
        <span className="explorer-tree-title">{title}</span>
      </Dropdown>
    )
  }

  const isEmpty = rootItems.length === 0

  return (
    <Flex className="explorer" vertical>
      <Flex className="explorer-toolbar" gap={4}>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            const page = createPage()
            openPage(page.id)
          }}
        >
          新建对话
        </Button>
        <Button
          type="text"
          size="small"
          icon={<FolderOutlined />}
          onClick={() => createFolder()}
        />
      </Flex>
      <div className="explorer-tree">
        {isEmpty ? (
          <Empty description="暂无对话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Tree
            treeData={treeData}
            selectedKeys={activePageId ? [activePageId] : []}
            expandedKeys={expandedKeys}
            onSelect={handleSelect}
            onExpand={handleExpand}
            draggable
            allowDrop={handleAllowDrop}
            onDrop={handleDrop}
            showIcon
            titleRender={titleRender}
            blockNode
          />
        )}
      </div>
    </Flex>
  )
}

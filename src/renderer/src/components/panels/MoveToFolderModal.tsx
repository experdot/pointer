import React, { useState, useMemo } from 'react'
import { Modal, Tree } from 'antd'
import type { TreeProps } from 'antd'
import { FolderOutlined, HomeOutlined } from '@ant-design/icons'
import type { PageFolder } from '../../types/type'

interface MoveToFolderModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (targetFolderId: string | undefined) => void
  folders: PageFolder[]
  /** 要排除的文件夹 ID 列表（包括要移动的文件夹及其子文件夹） */
  excludeFolderIds?: string[]
  /** 当前所在的文件夹 ID */
  currentFolderId?: string
}

interface TreeNode {
  key: string
  title: string
  icon: React.ReactNode
  children?: TreeNode[]
  disabled?: boolean
}

// 根目录的特殊 key
const ROOT_KEY = '__ROOT__'

export function MoveToFolderModal({
  open,
  onClose,
  onConfirm,
  folders,
  excludeFolderIds = [],
  currentFolderId
}: MoveToFolderModalProps): React.JSX.Element {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined)

  // 构建文件夹树
  const treeData = useMemo(() => {
    const excludeSet = new Set(excludeFolderIds)

    // 递归获取所有子文件夹 ID
    const getDescendantIds = (folderId: string): string[] => {
      const children = folders.filter((f) => f.parentFolderId === folderId)
      const ids: string[] = []
      for (const child of children) {
        ids.push(child.id)
        ids.push(...getDescendantIds(child.id))
      }
      return ids
    }

    // 将要排除的文件夹的所有子文件夹也加入排除集合
    for (const id of excludeFolderIds) {
      for (const descendantId of getDescendantIds(id)) {
        excludeSet.add(descendantId)
      }
    }

    // 递归构建树节点
    const buildTree = (parentId: string | undefined): TreeNode[] => {
      return folders
        .filter((f) => f.parentFolderId === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((folder) => ({
          key: folder.id,
          title: folder.name,
          icon: <FolderOutlined />,
          disabled: excludeSet.has(folder.id),
          children: buildTree(folder.id)
        }))
        .filter((node) => !excludeSet.has(node.key) || (node.children && node.children.length > 0))
    }

    // 根节点
    const rootNode: TreeNode = {
      key: ROOT_KEY,
      title: '根目录',
      icon: <HomeOutlined />,
      disabled: currentFolderId === undefined, // 已在根目录则禁用
      children: buildTree(undefined)
    }

    return [rootNode]
  }, [folders, excludeFolderIds, currentFolderId])

  const handleSelect: TreeProps['onSelect'] = (keys) => {
    if (keys.length > 0) {
      setSelectedKey(keys[0] as string)
    }
  }

  const handleConfirm = (): void => {
    if (selectedKey === undefined) return
    const targetFolderId = selectedKey === ROOT_KEY ? undefined : selectedKey
    onConfirm(targetFolderId)
    setSelectedKey(undefined)
    onClose()
  }

  const handleClose = (): void => {
    setSelectedKey(undefined)
    onClose()
  }

  return (
    <Modal
      title="移动至..."
      open={open}
      onCancel={handleClose}
      onOk={handleConfirm}
      okText="移动"
      okButtonProps={{ disabled: selectedKey === undefined }}
      cancelText="取消"
      width={360}
    >
      <Tree
        showIcon
        defaultExpandAll
        treeData={treeData}
        selectedKeys={selectedKey ? [selectedKey] : []}
        onSelect={handleSelect}
        style={{ maxHeight: 400, overflow: 'auto' }}
      />
    </Modal>
  )
}

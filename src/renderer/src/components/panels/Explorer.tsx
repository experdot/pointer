import React, { useState, useEffect, useCallback } from 'react'
import { Flex, Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  FolderOutlined,
  MessageOutlined,
  CheckSquareOutlined,
  EllipsisOutlined,
  DragOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons'
import { usePages } from '../../hooks/usePages'
import type { TreeNodeView } from '../../hooks/usePages'
import { useTabsStore } from '../../stores/tabsStore'
import { useMessagesStore } from '../../stores/messagesStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useGlobalSearchStore } from '../../stores/globalSearchStore'
import { useConfirmDialog } from '../common/ConfirmDialog'
import { TreeView } from '../common/TreeView'
import type { GenerateOptions } from '../common/AIGeneratePopover'
import { generateSessionTitle } from '../../services/titleService'
import { currentGeneration } from '../../runtime/generation'
import * as pagesService from '../../services/pagesService'
import { getStandardDropdownProps } from '../../utils/shortcutPresentation'
import { MoveToFolderModal } from './MoveToFolderModal'
import { MoveConflictModal, type MoveConflictInfo } from './MoveConflictModal'
import type { Page, Folder } from '@renderer/types/shared'
import { DEFAULT_FOLDER_NAME } from '@shared/domain'
import { resolveCreationTarget } from '../../utils/creationTarget'
import './Explorer.css'

export function Explorer(): React.JSX.Element {
  const {
    pages,
    folders,
    batchUpdateItemsOrder,
    batchUpdateItemsOrderWithRename,
    checkBatchMoveConflicts,
    createPage,
    deletePage,
    deletePages,
    updatePage,
    createFolder,
    deleteFolder,
    deleteFolders,
    clearFolder,
    updateFolder,
    toggleFolderExpanded,
    openPage,
    toggleStarPage
  } = usePages()

  const { tabs, activeTabId } = useTabsStore()
  const activePageId = tabs.find((t) => t.id === activeTabId)?.dataId
  const { showDeleteConfirm } = useConfirmDialog()
  const { setActivePanel } = useLayoutStore()
  const { setOptions: setSearchOptions } = useGlobalSearchStore()

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [multiSelect, setMultiSelect] = useState(false)
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])
  const [moveTarget, setMoveTarget] = useState<{
    type: 'page' | 'folder'
    id: string
    name: string
    parentFolderId?: string
  } | null>(null)
  const [moveConflict, setMoveConflict] = useState<MoveConflictInfo | null>(null)
  const [pendingDragOperation, setPendingDragOperation] = useState<{
    items: (Page | Folder)[]
    parentFolderId: string | undefined
    conflictNames: string[]
  } | null>(null)

  const messagesCache = useMessagesStore((state) => state.cache)

  useEffect(() => {
    if (activePageId) {
      setSelectedKey(activePageId)
    }
  }, [activePageId])

  const handleSelect = (id: string | null): void => {
    setSelectedKey(id)
    if (id) {
      const page = pages.find((p) => p.id === id)
      if (page) {
        openPage(id, true)
      }
    }
  }

  const handleDoubleClick = (id: string, isFolder: boolean): void => {
    if (!isFolder) {
      openPage(id, false)
    }
  }

  const handleCreatePage = async (): Promise<void> => {
    const page = await createPage(resolveCreationTarget(selectedKey, folders, pages))
    openPage(page.id)
  }

  const handleCreateFolder = async (): Promise<void> => {
    const folder = await createFolder(resolveCreationTarget(selectedKey, folders, pages))
    setSelectedKey(folder.id)
  }

  const handleCreatePageInFolder = async (folderId: string): Promise<void> => {
    const page = await createPage({ parentFolderId: folderId })
    openPage(page.id)
  }

  const handleCreateSubFolder = async (parentFolderId: string): Promise<void> => {
    const folder = await createFolder({ parentFolderId })
    setSelectedKey(folder.id)
  }

  const handleToggleMultiSelect = (): void => {
    setMultiSelect(!multiSelect)
    if (multiSelect) {
      setCheckedKeys([])
    }
  }

  const handleBatchDelete = (): void => {
    if (checkedKeys.length === 0) return
    showDeleteConfirm({
      title: `删除 ${checkedKeys.length} 个项目`,
      onOk: async () => {
        const pageIds = checkedKeys.filter((key) => pages.some((p) => p.id === key))
        const folderIds = checkedKeys.filter((key) => folders.some((f) => f.id === key))
        await deletePages(pageIds)
        await deleteFolders(folderIds)
        setCheckedKeys([])
        setMultiSelect(false)
      }
    })
  }

  const getAllKeys = (): string[] => {
    return [...pages.map((p) => p.id), ...folders.map((f) => f.id)]
  }

  const allKeys = getAllKeys()
  const isAllSelected = allKeys.length > 0 && checkedKeys.length === allKeys.length

  const handleSelectAll = (): void => {
    setCheckedKeys(isAllSelected ? [] : getAllKeys())
  }

  // AI 生成标题 - 直接在回调中执行生成
  const handleGenerateItemName = useCallback(
    async (pageId: string, options: GenerateOptions): Promise<void> => {
      const pageMessages = messagesCache[pageId]?.messages || []
      if (pageMessages.length === 0) return

      const generation = currentGeneration()
      void pageMessages
      const result = await generateSessionTitle(pageId, options)
      void result
      void generation
    },
    [messagesCache]
  )

  // 右键菜单 - 星标（置顶，后接分割线）
  const getItemLeadingMenuItems = useCallback(
    (page: Page): MenuProps['items'] => [
      {
        key: 'star',
        label: page.starred ? '取消星标' : '标记为星标',
        icon: page.starred ? <StarFilled /> : <StarOutlined />,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          toggleStarPage(page.id)
        }
      },
      { type: 'divider' }
    ],
    [toggleStarPage]
  )

  // 右键菜单 - 移动至...
  const getItemMenuItems = useCallback(
    (page: Page): MenuProps['items'] => [
      {
        key: 'move',
        label: '移动至...',
        icon: <DragOutlined />,
        disabled: folders.length === 0,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          setMoveTarget({
            type: 'page',
            id: page.id,
            name: page.name,
            parentFolderId: page.parentFolderId
          })
        }
      }
    ],
    [folders.length]
  )

  // 已星标的会话在标题前显示星标图标
  const getItemTitleExtra = useCallback(
    (page: Page): React.ReactNode =>
      page.starred ? <StarFilled className="explorer-tree-item-star" /> : null,
    []
  )

  const getFolderMenuItems = useCallback(
    (folder: Folder): MenuProps['items'] => [
      {
        key: 'move',
        label: '移动至...',
        icon: <DragOutlined />,
        disabled: folders.length === 0,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          setMoveTarget({
            type: 'folder',
            id: folder.id,
            name: folder.name,
            parentFolderId: folder.parentFolderId
          })
        }
      },
      { type: 'divider' },
      {
        key: 'search',
        label: '在文件夹中查找...',
        icon: <SearchOutlined />,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          setSearchOptions({ folderIds: [folder.id] })
          setActivePanel('search')
        }
      }
    ],
    [folders.length, setSearchOptions, setActivePanel]
  )

  const handleMoveConfirm = useCallback(
    async (targetFolderId: string | undefined): Promise<void> => {
      if (!moveTarget) return

      // 与迁移前一致：目标文件夹已有同名节点时先弹冲突对话框
      const conflict =
        moveTarget.type === 'page'
          ? pagesService.checkPageNameConflict(moveTarget.name, targetFolderId, moveTarget.id)
          : pagesService.checkFolderNameConflict(moveTarget.name, targetFolderId, moveTarget.id)

      if (conflict) {
        setMoveConflict({
          type: moveTarget.type,
          id: moveTarget.id,
          name: moveTarget.name,
          targetFolderId
        })
        return
      }

      if (moveTarget.type === 'page') {
        await pagesService.movePage(moveTarget.id, targetFolderId)
      } else {
        await pagesService.moveFolder(moveTarget.id, targetFolderId)
      }
      setMoveTarget(null)
    },
    [moveTarget]
  )

  const handleConflictAutoRename = useCallback(async (): Promise<void> => {
    if (!moveConflict) return

    if (moveConflict.type === 'page') {
      await pagesService.movePage(moveConflict.id, moveConflict.targetFolderId)
    } else {
      await pagesService.moveFolder(moveConflict.id, moveConflict.targetFolderId)
    }

    setMoveConflict(null)
    setMoveTarget(null)
  }, [moveConflict])

  const handleConflictCancel = useCallback((): void => {
    setMoveConflict(null)
    setPendingDragOperation(null)
    // 保持 moveTarget 不变，用户可以选择其他目标文件夹
  }, [])

  // 包装 batchUpdateItemsOrder，检查拖拽冲突
  const handleBatchUpdateItemsOrder = useCallback(
    (items: (Page | Folder)[], parentFolderId?: string) => {
      const nodes = items as TreeNodeView[]
      const { hasConflict, conflictNames } = checkBatchMoveConflicts(nodes, parentFolderId)

      if (hasConflict) {
        // 有冲突，保存待处理操作，显示冲突对话框
        setPendingDragOperation({ items, parentFolderId, conflictNames })
        setMoveConflict({
          type: items[0]?.kind === 'page' ? 'page' : 'folder',
          id: items[0]?.id ?? '',
          name: conflictNames[0] ?? '',
          targetFolderId: parentFolderId
        })
        return
      }

      // 无冲突，直接执行
      void batchUpdateItemsOrder(nodes, parentFolderId)
    },
    [checkBatchMoveConflicts, batchUpdateItemsOrder]
  )

  // 处理拖拽冲突的自动重命名
  const handleDragConflictAutoRename = useCallback((): void => {
    if (pendingDragOperation) {
      void batchUpdateItemsOrderWithRename(
        pendingDragOperation.items as TreeNodeView[],
        pendingDragOperation.parentFolderId
      )
    }
    setPendingDragOperation(null)
    setMoveConflict(null)
  }, [pendingDragOperation, batchUpdateItemsOrderWithRename])

  const menuItems: MenuProps['items'] = [
    { key: 'folder', label: DEFAULT_FOLDER_NAME, icon: <FolderOutlined /> },
    { key: 'multiSelect', label: '多选删除', icon: <CheckSquareOutlined /> }
  ]

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'folder') handleCreateFolder()
    else if (key === 'multiSelect') handleToggleMultiSelect()
  }

  const isEmpty = pages.length === 0 && folders.length === 0

  return (
    <Flex className="explorer" vertical>
      <Flex className="explorer-toolbar" gap={4}>
        {multiSelect ? (
          <>
            <Button
              type="text"
              icon={<CheckSquareOutlined />}
              onClick={handleSelectAll}
              disabled={allKeys.length === 0}
            >
              {isAllSelected ? '取消全选' : '全选'}
            </Button>
            <Button danger onClick={handleBatchDelete} disabled={checkedKeys.length === 0}>
              删除 ({checkedKeys.length})
            </Button>
            <Button type="text" onClick={handleToggleMultiSelect}>
              取消
            </Button>
          </>
        ) : (
          <Dropdown.Button
            type="text"
            icon={<EllipsisOutlined />}
            {...getStandardDropdownProps({ items: menuItems, onClick: onMenuClick })}
            onClick={handleCreatePage}
          >
            <PlusOutlined /> 新建对话
          </Dropdown.Button>
        )}
      </Flex>
      <TreeView<Page, Folder>
        items={pages}
        folders={folders}
        selectedId={selectedKey}
        onSelect={handleSelect}
        itemIcon={<MessageOutlined />}
        getItemName={(page) => page.name}
        getItemTitleExtra={getItemTitleExtra}
        isItem={(item): item is Page => (item as Page | Folder).kind === 'page'}
        batchUpdateItemsOrder={handleBatchUpdateItemsOrder}
        updateItem={(id, name) => updatePage(id, { name })}
        deleteItem={deletePage}
        updateFolder={(id, name) => updateFolder(id, { name })}
        deleteFolder={deleteFolder}
        clearFolder={clearFolder}
        toggleFolderExpanded={toggleFolderExpanded}
        onDoubleClick={handleDoubleClick}
        onGenerateItemName={handleGenerateItemName}
        onCreateItemInFolder={handleCreatePageInFolder}
        onCreateSubFolder={handleCreateSubFolder}
        createItemLabel="新建对话"
        createFolderLabel={DEFAULT_FOLDER_NAME}
        getItemLeadingMenuItems={getItemLeadingMenuItems}
        getItemMenuItems={getItemMenuItems}
        getFolderMenuItems={getFolderMenuItems}
        emptyText={isEmpty ? '暂无对话' : undefined}
        className="explorer-tree"
        checkable={multiSelect}
        checkedKeys={checkedKeys}
        onCheck={setCheckedKeys}
      />
      <MoveToFolderModal
        open={moveTarget !== null}
        onClose={() => setMoveTarget(null)}
        onConfirm={handleMoveConfirm}
        folders={folders}
        excludeFolderIds={moveTarget?.type === 'folder' ? [moveTarget.id] : []}
        currentFolderId={moveTarget?.parentFolderId}
      />
      <MoveConflictModal
        open={moveConflict !== null}
        conflict={moveConflict}
        onCancel={handleConflictCancel}
        onAutoRename={
          pendingDragOperation ? handleDragConflictAutoRename : handleConflictAutoRename
        }
      />
    </Flex>
  )
}

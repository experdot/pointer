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
  SearchOutlined
} from '@ant-design/icons'
import { usePages } from '../../hooks/usePages'
import { useTabsStore } from '../../stores/tabsStore'
import { useMessagesStore } from '../../stores/messagesStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useGlobalSearchStore } from '../../stores/globalSearchStore'
import { useConfirmDialog } from '../common/ConfirmDialog'
import { TreeView } from '../common/TreeView'
import type { GenerateOptions } from '../common/AIGeneratePopover'
import { generateSessionTitleWithOptions } from '../../services/titleService'
import { MoveToFolderModal } from './MoveToFolderModal'
import type { ChatPage, PageFolder } from '../../types/type'
import { isPage } from '../../types/type'
import './Explorer.css'

export function Explorer(): React.JSX.Element {
  const {
    pages,
    folders,
    batchUpdateItemsOrder,
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
    openPage
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
    parentFolderId?: string
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
    const page = await createPage(undefined, selectedKey ?? undefined)
    openPage(page.id)
  }

  const handleCreateFolder = async (): Promise<void> => {
    const folder = await createFolder(undefined, selectedKey ?? undefined)
    setSelectedKey(folder.id)
  }

  const handleCreatePageInFolder = async (folderId: string): Promise<void> => {
    const page = await createPage(undefined, undefined, folderId)
    openPage(page.id)
  }

  const handleCreateSubFolder = async (parentFolderId: string): Promise<void> => {
    const folder = await createFolder(undefined, undefined, parentFolderId)
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

      const result = await generateSessionTitleWithOptions(pageMessages, options)
      if (result.success && result.title) {
        await updatePage(pageId, { name: result.title })
      }
    },
    [messagesCache, updatePage]
  )

  // 右键菜单 - 移动至...
  const getItemMenuItems = useCallback(
    (page: ChatPage): MenuProps['items'] => [
      {
        key: 'move',
        label: '移动至...',
        icon: <DragOutlined />,
        disabled: folders.length === 0,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          setMoveTarget({ type: 'page', id: page.id, parentFolderId: page.parentFolderId })
        }
      }
    ],
    [folders.length]
  )

  const getFolderMenuItems = useCallback(
    (folder: PageFolder): MenuProps['items'] => [
      {
        key: 'search',
        label: '查找...',
        icon: <SearchOutlined />,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          setSearchOptions({ folderIds: [folder.id] })
          setActivePanel('search')
        }
      },
      {
        key: 'move',
        label: '移动至...',
        icon: <DragOutlined />,
        disabled: folders.length === 0,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          setMoveTarget({ type: 'folder', id: folder.id, parentFolderId: folder.parentFolderId })
        }
      }
    ],
    [folders.length, setSearchOptions, setActivePanel]
  )

  const handleMoveConfirm = useCallback(
    async (targetFolderId: string | undefined): Promise<void> => {
      if (!moveTarget) return
      if (moveTarget.type === 'page') {
        await updatePage(moveTarget.id, { parentFolderId: targetFolderId })
      } else {
        await updateFolder(moveTarget.id, { parentFolderId: targetFolderId })
      }
      setMoveTarget(null)
    },
    [moveTarget, updatePage, updateFolder]
  )

  const menuItems: MenuProps['items'] = [
    { key: 'folder', label: '新建文件夹', icon: <FolderOutlined /> },
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
            menu={{ items: menuItems, onClick: onMenuClick }}
            onClick={handleCreatePage}
          >
            <PlusOutlined /> 新建对话
          </Dropdown.Button>
        )}
      </Flex>
      <TreeView<ChatPage, PageFolder>
        items={pages}
        folders={folders}
        selectedId={selectedKey}
        onSelect={handleSelect}
        itemIcon={<MessageOutlined />}
        getItemName={(page) => page.name}
        isItem={(item): item is ChatPage => isPage(item as ChatPage | PageFolder)}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
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
        createFolderLabel="新建文件夹"
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
    </Flex>
  )
}

import React, { useState, useEffect } from 'react'
import { Flex, Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  FolderOutlined,
  MessageOutlined,
  CheckSquareOutlined,
  EllipsisOutlined
} from '@ant-design/icons'
import { usePages } from '../../hooks/usePages'
import { useTabsStore } from '../../stores/tabsStore'
import { useConfirmDialog } from '../common/ConfirmDialog'
import { TreeView } from '../common/TreeView'
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
    updateFolder,
    toggleFolderExpanded,
    openPage
  } = usePages()

  const { tabs, activeTabId } = useTabsStore()
  const activePageId = tabs.find((t) => t.id === activeTabId)?.dataId
  const { showDeleteConfirm } = useConfirmDialog()

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [multiSelect, setMultiSelect] = useState(false)
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

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
        getItemName={(page) => page.title}
        isItem={(item): item is ChatPage => isPage(item as ChatPage | PageFolder)}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
        updateItem={(id, name) => updatePage(id, { title: name })}
        deleteItem={deletePage}
        updateFolder={(id, name) => updateFolder(id, { name })}
        deleteFolder={deleteFolder}
        toggleFolderExpanded={toggleFolderExpanded}
        onDoubleClick={handleDoubleClick}
        emptyText={isEmpty ? '暂无对话' : undefined}
        className="explorer-tree"
        checkable={multiSelect}
        checkedKeys={checkedKeys}
        onCheck={setCheckedKeys}
      />
    </Flex>
  )
}

import React, { useState, useEffect } from 'react'
import { Flex, Button } from 'antd'
import { PlusOutlined, FolderOutlined, MessageOutlined } from '@ant-design/icons'
import { usePages } from '../../hooks/usePages'
import { useTabsStore } from '../../stores/tabsStore'
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
    updatePage,
    createFolder,
    deleteFolder,
    updateFolder,
    toggleFolderExpanded,
    openPage
  } = usePages()

  const { tabs, activeTabId } = useTabsStore()
  const activePageId = tabs.find((t) => t.id === activeTabId)?.dataId

  const [selectedKey, setSelectedKey] = useState<string | null>(null)

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

  const isEmpty = pages.length === 0 && folders.length === 0

  return (
    <Flex className="explorer" vertical>
      <Flex className="explorer-toolbar" gap={4}>
        <Button
          color="default"
          variant="filled"
          icon={<PlusOutlined />}
          onClick={async () => {
            const page = await createPage(undefined, selectedKey ?? undefined)
            openPage(page.id)
          }}
        >
          新建对话
        </Button>
        <Button
          type="text"
          icon={<FolderOutlined />}
          onClick={async () => {
            const folder = await createFolder(undefined, selectedKey ?? undefined)
            setSelectedKey(folder.id)
          }}
        />
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
      />
    </Flex>
  )
}

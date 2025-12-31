import React, { useState } from 'react'
import { Button } from 'antd'
import type { MenuProps } from 'antd'
import { PlusOutlined, FolderOutlined, CopyOutlined, CheckSquareOutlined } from '@ant-design/icons'
import { useConfirmDialog } from './ConfirmDialog'
import { TreeView } from './TreeView'
import type { ConfigFolder, ConfigItemBase } from '../../types/type'
import './ConfigTree.css'

export interface ConfigTreeProps<T extends ConfigItemBase> {
  items: T[]
  folders: ConfigFolder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  itemIcon: React.ReactNode
  itemNameKey: keyof T
  isItem: (item: T | ConfigFolder) => item is T
  batchUpdateItemsOrder: (items: (T | ConfigFolder)[], parentFolderId?: string) => void
  createItem: () => T
  updateItem: (id: string, updates: Partial<T>) => void
  deleteItem: (id: string) => void
  copyItem?: (item: T) => T
  createFolder: (name?: string) => ConfigFolder
  updateFolder: (id: string, updates: Partial<ConfigFolder>) => void
  deleteFolder: (id: string) => void
  toggleFolderExpanded: (id: string) => void
  defaultItemId?: string
  emptyText?: string
  addItemText?: string
}

export function ConfigTree<T extends ConfigItemBase>({
  items,
  folders,
  selectedId,
  onSelect,
  itemIcon,
  itemNameKey,
  isItem,
  batchUpdateItemsOrder,
  createItem,
  updateItem,
  deleteItem,
  copyItem,
  createFolder,
  updateFolder,
  deleteFolder,
  toggleFolderExpanded,
  defaultItemId,
  emptyText = '暂无配置',
  addItemText = '添加配置'
}: ConfigTreeProps<T>): React.JSX.Element {
  const { showDeleteConfirm } = useConfirmDialog()
  const [multiSelect, setMultiSelect] = useState(false)
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])

  const handleCreate = (): void => {
    const item = createItem()
    onSelect(item.id)
  }

  const handleCreateFolder = (): void => {
    const folder = createFolder('新文件夹')
    onSelect(folder.id)
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
      onOk: () => {
        checkedKeys.forEach((key) => {
          const item = items.find((i) => i.id === key)
          const folder = folders.find((f) => f.id === key)
          if (item) deleteItem(key)
          else if (folder) deleteFolder(key)
        })
        setCheckedKeys([])
        setMultiSelect(false)
      }
    })
  }

  const getItemMenuItems = (item: T): MenuProps['items'] => {
    if (!copyItem) return []
    return [
      {
        key: 'copy',
        label: '复制',
        icon: <CopyOutlined />,
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          const newItem = copyItem(item)
          onSelect(newItem.id)
        }
      }
    ]
  }

  return (
    <div className="config-tree">
      <div className="config-tree-toolbar">
        {multiSelect ? (
          <>
            <Button danger onClick={handleBatchDelete} disabled={checkedKeys.length === 0}>
              删除 ({checkedKeys.length})
            </Button>
            <Button type="text" onClick={handleToggleMultiSelect}>
              取消
            </Button>
          </>
        ) : (
          <>
            <Button color="default" variant="filled" icon={<PlusOutlined />} onClick={handleCreate}>
              {addItemText}
            </Button>
            <Button type="text" icon={<FolderOutlined />} onClick={handleCreateFolder} />
            <Button type="text" icon={<CheckSquareOutlined />} onClick={handleToggleMultiSelect} />
          </>
        )}
      </div>
      <TreeView<T, ConfigFolder>
        items={items}
        folders={folders}
        selectedId={selectedId}
        onSelect={onSelect}
        itemIcon={itemIcon}
        getItemName={(item) => item[itemNameKey] as string}
        isItem={isItem}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
        updateItem={(id, name) => updateItem(id, { [itemNameKey]: name } as Partial<T>)}
        deleteItem={deleteItem}
        updateFolder={(id, name) => updateFolder(id, { name })}
        deleteFolder={deleteFolder}
        toggleFolderExpanded={toggleFolderExpanded}
        getItemMenuItems={copyItem ? getItemMenuItems : undefined}
        highlightId={defaultItemId}
        emptyText={emptyText}
        className="config-tree-content"
      />
    </div>
  )
}

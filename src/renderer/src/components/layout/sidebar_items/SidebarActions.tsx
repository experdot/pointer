import React from 'react'
import { Button, Space, Tooltip, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  FolderAddOutlined,
  DeleteOutlined,
  TableOutlined,
  BlockOutlined,
  DownOutlined
} from '@ant-design/icons'

interface SidebarActionsProps {
  collapsed?: boolean
  hasCheckedItems?: boolean
  onCreateChat: () => void
  onCreateCrosstabChat: () => void
  onCreateObjectChat: () => void
  onCreateFolder: () => void
  onBatchDelete?: () => void
}

export default function SidebarActions({
  collapsed = false,
  hasCheckedItems = false,
  onCreateChat,
  onCreateCrosstabChat,
  onCreateObjectChat,
  onCreateFolder,
  onBatchDelete
}: SidebarActionsProps) {
  const createOptions: MenuProps['items'] = [
    {
      key: 'crosstab',
      label: '新建交叉视图',
      icon: <TableOutlined />,
      onClick: onCreateCrosstabChat
    },
    {
      key: 'object',
      label: '新建对象页面',
      icon: <BlockOutlined />,
      onClick: onCreateObjectChat
    },
    {
      key: 'folder',
      label: '新建文件夹',
      icon: <FolderAddOutlined />,
      onClick: onCreateFolder
    }
  ]
  if (collapsed) {
    return (
      <div className="sidebar-actions-collapsed">
        <Button.Group>
          <Tooltip title="新建聊天" placement="right">
            <Button type="text" icon={<PlusOutlined />} onClick={onCreateChat} />
          </Tooltip>
          <Tooltip title="更多选项" placement="right">
            <Dropdown menu={{ items: createOptions }} trigger={['click']}>
              <Button type="text" icon={<DownOutlined />} />
            </Dropdown>
          </Tooltip>
        </Button.Group>
        {hasCheckedItems && (
          <Tooltip title="批量删除" placement="right">
            <Button
              type="text"
              danger
              className="batch-delete-btn"
              icon={<DeleteOutlined />}
              onClick={onBatchDelete}
            />
          </Tooltip>
        )}
      </div>
    )
  }

  return (
    <div className="sidebar-actions">
      <Space>
        <Button.Group>
          <Tooltip title="新建聊天">
            <Button type="text" icon={<PlusOutlined />} onClick={onCreateChat}>
              新建聊天
            </Button>
          </Tooltip>
          <Tooltip title="更多选项">
            <Dropdown menu={{ items: createOptions }} trigger={['click']}>
              <Button type="text" icon={<DownOutlined />} />
            </Dropdown>
          </Tooltip>
        </Button.Group>
        {hasCheckedItems && (
          <Tooltip title="批量删除">
            <Button
              type="text"
              danger
              className="batch-delete-btn"
              icon={<DeleteOutlined />}
              onClick={onBatchDelete}
            />
          </Tooltip>
        )}
      </Space>
    </div>
  )
}

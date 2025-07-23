import React from 'react'
import { Button, Space, Tooltip } from 'antd'
import {
  PlusOutlined,
  FolderAddOutlined,
  DeleteOutlined,
  TableOutlined,
  BlockOutlined
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
  if (collapsed) {
    return (
      <div className="sidebar-actions-collapsed">
        <Tooltip title="新建聊天" placement="right">
          <Button type="text" icon={<PlusOutlined />} onClick={onCreateChat} />
        </Tooltip>
        <Tooltip title="新建交叉视图" placement="right">
          <Button type="text" icon={<TableOutlined />} onClick={onCreateCrosstabChat} />
        </Tooltip>
        <Tooltip title="新建对象页面" placement="right">
          <Button type="text" icon={<BlockOutlined />} onClick={onCreateObjectChat} />
        </Tooltip>
        <Tooltip title="新建文件夹" placement="right">
          <Button type="text" icon={<FolderAddOutlined />} onClick={onCreateFolder} />
        </Tooltip>
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
        <Tooltip title="新建聊天">
          <Button type="text" icon={<PlusOutlined />} onClick={onCreateChat} />
        </Tooltip>
        <Tooltip title="新建交叉视图">
          <Button type="text" icon={<TableOutlined />} onClick={onCreateCrosstabChat} />
        </Tooltip>
        <Tooltip title="新建对象页面">
          <Button type="text" icon={<BlockOutlined />} onClick={onCreateObjectChat} />
        </Tooltip>
        <Tooltip title="新建文件夹">
          <Button type="text" icon={<FolderAddOutlined />} onClick={onCreateFolder} />
        </Tooltip>
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

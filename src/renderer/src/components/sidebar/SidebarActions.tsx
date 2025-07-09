import React from 'react'
import { Button, Space, Tooltip } from 'antd'
import {
  PlusOutlined,
  FolderAddOutlined,
  SettingOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  BorderOutlined,
  SearchOutlined,
  TableOutlined,
  BlockOutlined
} from '@ant-design/icons'

interface SidebarActionsProps {
  collapsed?: boolean
  multiSelectMode?: boolean
  hasCheckedItems?: boolean
  onCreateChat: () => void
  onCreateCrosstabChat: () => void
  onCreateObjectChat: () => void
  onCreateFolder: () => void
  onOpenSettings: () => void
  onToggleMultiSelect?: () => void
  onBatchDelete?: () => void
  onOpenSearch?: () => void
}

export default function SidebarActions({
  collapsed = false,
  multiSelectMode = false,
  hasCheckedItems = false,
  onCreateChat,
  onCreateCrosstabChat,
  onCreateObjectChat,
  onCreateFolder,
  onOpenSettings,
  onToggleMultiSelect,
  onBatchDelete,
  onOpenSearch
}: SidebarActionsProps) {
  if (collapsed) {
    return (
      <div className="sidebar-actions-collapsed">
        <Tooltip title="全局搜索" placement="right">
          <Button type="text" icon={<SearchOutlined />} onClick={onOpenSearch} />
        </Tooltip>
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
        <Tooltip title={multiSelectMode ? '退出多选' : '多选模式'} placement="right">
          <Button
            type={multiSelectMode ? 'primary' : 'text'}
            icon={multiSelectMode ? <CheckSquareOutlined /> : <BorderOutlined />}
            onClick={onToggleMultiSelect}
          />
        </Tooltip>
        {multiSelectMode && hasCheckedItems && (
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
        <Tooltip title="设置" placement="right">
          <Button type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="sidebar-actions">
      <Space>
        <Tooltip title="全局搜索">
          <Button type="text" icon={<SearchOutlined />} onClick={onOpenSearch} />
        </Tooltip>
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
        <Tooltip title={multiSelectMode ? '退出多选' : '多选模式'}>
          <Button
            type={multiSelectMode ? 'primary' : 'text'}
            icon={multiSelectMode ? <CheckSquareOutlined /> : <BorderOutlined />}
            onClick={onToggleMultiSelect}
          />
        </Tooltip>
        {multiSelectMode && hasCheckedItems && (
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
        <Tooltip title="设置">
          <Button type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
      </Space>
    </div>
  )
}

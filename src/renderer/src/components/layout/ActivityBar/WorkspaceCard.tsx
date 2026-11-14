import React, { useState } from 'react'
import { Flex, Typography, Button, Divider, List, App, Tooltip } from 'antd'
import { FolderOutlined, FolderOpenOutlined, DeleteOutlined } from '@ant-design/icons'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { useSavedAction } from '../../../hooks/useSavedAction'
import {
  switchWorkspace,
  openFolderAsWorkspace,
  deleteWorkspace,
  repairWorkspacePath,
  pickWorkspaceDirectory,
  validateWorkspacePath,
  openWorkspaceInFileManager
} from '../../../services/workspaceService'
import type { WorkspaceSummary } from '@renderer/types/shared'
import './WorkspaceCard.css'

const { Text } = Typography

interface WorkspaceCardProps {
  onClose: () => void
}

export function WorkspaceCard({ onClose }: WorkspaceCardProps): React.JSX.Element {
  const { workspaces, currentWorkspaceId, currentWorkspace } = useWorkspaceStore()
  const [switching, setSwitching] = useState(false)
  const { message, modal } = App.useApp()
  const runSaved = useSavedAction()

  const handleSwitchWorkspace = async (workspaceId: string): Promise<void> => {
    if (workspaceId === currentWorkspaceId || switching) return
    setSwitching(true)
    try {
      if (await runSaved(() => switchWorkspace(workspaceId))) onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '切换工作区失败')
      console.error('Failed to switch workspace:', error)
    } finally {
      setSwitching(false)
    }
  }

  const handleOpenFolder = async (): Promise<void> => {
    if (switching) return
    try {
      const selectedPath = await pickWorkspaceDirectory('选择工作区文件夹')
      if (!selectedPath) return

      try {
        if (!(await runSaved(() => openFolderAsWorkspace(selectedPath)))) return
      } catch (error) {
        const validation = await validateWorkspacePath(selectedPath).catch(() => null)
        if (validation?.repairable) {
          modal.confirm({
            title: '工作区需要修复',
            content: '检测到该工作区缺少部分内部目录或元数据。确认后会补齐缺失项，然后继续打开。',
            okText: '修复并打开',
            cancelText: '取消',
            onOk: async () => {
              try {
                if (!(await runSaved(() => repairWorkspacePath(selectedPath)))) return
                if (await runSaved(() => openFolderAsWorkspace(selectedPath))) onClose()
              } catch (repairError) {
                const repairMessage =
                  repairError instanceof Error ? repairError.message : '修复工作区失败'
                message.error(repairMessage)
                console.error('Failed to repair workspace:', repairError)
              }
            }
          })
          return
        }
        throw error
      }
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '打开文件夹失败'
      if (errorMessage.includes('locked by another account')) {
        message.error('该文件夹已被其他账户占用')
      } else {
        message.error(errorMessage)
      }
      console.error('Failed to open folder:', error)
    }
  }

  const handleOpenInFileManager = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    const workspacePath = currentWorkspace?.path
    if (!workspacePath) {
      message.warning('当前没有可打开的工作区')
      return
    }

    try {
      void workspacePath
      await openWorkspaceInFileManager()
    } catch (error) {
      message.error('打开文件夹失败')
      console.error('Failed to open workspace in file manager:', error)
    }
  }

  const handleDeleteWorkspace = async (
    workspace: WorkspaceSummary,
    e: React.MouseEvent
  ): Promise<void> => {
    e.stopPropagation()
    if (workspace.type === 'default') {
      message.warning('默认工作区不能删除')
      return
    }

    modal.confirm({
      title: '移除工作区',
      content: `确定要从列表中移除工作区 "${workspace.name}" 吗？这不会删除文件夹中的文件。`,
      okText: '移除',
      cancelText: '取消',
      onOk: async () => {
        try {
          if (await runSaved(() => deleteWorkspace(workspace.id))) message.success('工作区已移除')
        } catch (error) {
          message.error('移除工作区失败')
          console.error('Failed to delete workspace:', error)
        }
      }
    })
  }

  return (
    <Flex vertical gap={8} style={{ width: 260 }}>
      <Flex align="center" gap={12}>
        <FolderOutlined style={{ fontSize: 24 }} />
        <Flex vertical flex={1} style={{ overflow: 'hidden' }}>
          <Text strong ellipsis>
            {currentWorkspace?.name || '未选择工作区'}
          </Text>
          {currentWorkspace?.type === 'custom' && (
            <Text
              type="secondary"
              style={{ fontSize: 12 }}
              ellipsis={{ tooltip: currentWorkspace.path }}
            >
              {currentWorkspace.path}
            </Text>
          )}
        </Flex>
        <Tooltip title="在文件资源管理器中打开">
          <Button
            type="text"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={handleOpenInFileManager}
            disabled={!currentWorkspace}
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
      </Flex>
      <Divider style={{ margin: '8px 0' }} />
      <Text type="secondary">切换工作区</Text>
      <List
        size="small"
        style={{
          maxHeight: 'min(320px, calc(100vh - 240px))',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
        dataSource={workspaces.filter((workspace) => workspace.id !== currentWorkspaceId)}
        locale={{ emptyText: '暂无其他工作区' }}
        renderItem={(workspace) => (
          <List.Item
            className="workspace-card__item"
            style={{ padding: '8px', cursor: 'pointer' }}
            onClick={() => handleSwitchWorkspace(workspace.id)}
          >
            <Flex align="center" gap={8} flex={1} style={{ minWidth: 0 }}>
              <FolderOutlined style={{ fontSize: 16 }} />
              <Flex vertical flex={1} style={{ overflow: 'hidden' }}>
                <Text ellipsis>{workspace.name}</Text>
                {workspace.type === 'custom' && (
                  <Text
                    type="secondary"
                    style={{ fontSize: 12 }}
                    ellipsis={{ tooltip: workspace.path }}
                  >
                    {workspace.path}
                  </Text>
                )}
              </Flex>
              {workspace.type === 'custom' && (
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => handleDeleteWorkspace(workspace, e)}
                  style={{ flexShrink: 0 }}
                />
              )}
            </Flex>
          </List.Item>
        )}
      />
      <Divider style={{ margin: '8px 0' }} />
      <Button
        type="text"
        icon={<FolderOpenOutlined />}
        block
        style={{ justifyContent: 'flex-start' }}
        onClick={handleOpenFolder}
        loading={switching}
      >
        打开文件夹...
      </Button>
    </Flex>
  )
}

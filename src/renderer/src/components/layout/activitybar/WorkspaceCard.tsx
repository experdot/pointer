import React, { useState } from 'react'
import { Flex, Typography, Button, Divider, List, App } from 'antd'
import {
  FolderOutlined,
  FolderOpenOutlined,
  SwapOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import {
  switchWorkspace,
  openFolderAsWorkspace,
  deleteWorkspace,
  repairWorkspacePath,
  WorkspaceRepairRequiredError
} from '../../../services/workspaceService'
import type { WorkspaceMetadata } from '../../../types/workspace'
import { useSwitchTransactionStore } from '../../../stores/switchTransactionStore'

const { Text } = Typography

interface WorkspaceCardProps {
  onClose: () => void
}

export function WorkspaceCard({ onClose }: WorkspaceCardProps): React.JSX.Element {
  const { workspaces, currentWorkspaceId, currentWorkspace } = useWorkspaceStore()
  const [showWorkspaceList, setShowWorkspaceList] = useState(false)
  const switching = useSwitchTransactionStore((state) => state.inProgress)
  const { message, modal } = App.useApp()

  const handleSwitchWorkspace = async (workspaceId: string): Promise<void> => {
    if (workspaceId === currentWorkspaceId || switching) return
    try {
      await switchWorkspace(workspaceId)
      onClose()
    } catch (error) {
      message.error('切换工作区失败')
      console.error('Failed to switch workspace:', error)
    }
  }

  const handleOpenFolder = async (): Promise<void> => {
    if (switching) return
    try {
      const result = await window.api.fs.selectDirectory({
        title: '选择工作区文件夹'
      })

      if (!result.success || !result.path) {
        return
      }

      try {
        await openFolderAsWorkspace(result.path)
      } catch (error) {
        if (error instanceof WorkspaceRepairRequiredError) {
          modal.confirm({
            title: '工作区需要修复',
            content: '检测到该工作区缺少部分内部目录或元数据。确认后会补齐缺失项，然后继续打开。',
            okText: '修复并打开',
            cancelText: '取消',
            onOk: async () => {
              try {
                await repairWorkspacePath(error.dirPath)
                await openFolderAsWorkspace(error.dirPath)
                onClose()
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

  const handleDeleteWorkspace = async (
    workspace: WorkspaceMetadata,
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
          await deleteWorkspace(workspace.id)
          message.success('工作区已移除')
        } catch (error) {
          message.error('移除工作区失败')
          console.error('Failed to delete workspace:', error)
        }
      }
    })
  }

  if (showWorkspaceList) {
    return (
      <Flex vertical gap={8} style={{ width: 260 }}>
        <Flex align="center" gap={8}>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => setShowWorkspaceList(false)}
          />
          <Text strong>选择工作区</Text>
        </Flex>
        <Divider style={{ margin: '4px 0' }} />
        <List
          size="small"
          dataSource={workspaces}
          renderItem={(workspace) => (
            <List.Item
              style={{ padding: '8px', cursor: 'pointer' }}
              onClick={() => handleSwitchWorkspace(workspace.id)}
            >
              <Flex align="center" gap={8} flex={1}>
                {workspace.type === 'default' ? (
                  <FolderOutlined style={{ fontSize: 16 }} />
                ) : (
                  <FolderOpenOutlined style={{ fontSize: 16, color: '#1677ff' }} />
                )}
                <Flex vertical flex={1} style={{ overflow: 'hidden' }}>
                  <Text ellipsis>{workspace.name}</Text>
                  {workspace.type === 'custom' && (
                    <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                      {workspace.path}
                    </Text>
                  )}
                </Flex>
                {workspace.id === currentWorkspaceId ? (
                  <CheckOutlined style={{ color: '#1677ff', flexShrink: 0 }} />
                ) : workspace.type === 'custom' ? (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => handleDeleteWorkspace(workspace, e)}
                    style={{ flexShrink: 0 }}
                  />
                ) : null}
              </Flex>
            </List.Item>
          )}
        />
        <Divider style={{ margin: '4px 0' }} />
        <Button
          type="dashed"
          icon={<FolderOpenOutlined />}
          block
          onClick={handleOpenFolder}
          loading={switching}
        >
          打开文件夹...
        </Button>
      </Flex>
    )
  }

  return (
    <Flex vertical gap={8} style={{ width: 240 }}>
      <Flex align="center" gap={12}>
        {currentWorkspace?.type === 'default' ? (
          <FolderOutlined style={{ fontSize: 24 }} />
        ) : (
          <FolderOpenOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        )}
        <Flex vertical style={{ overflow: 'hidden' }}>
          <Text strong ellipsis>
            {currentWorkspace?.name || '未选择工作区'}
          </Text>
          {currentWorkspace?.type === 'custom' && (
            <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
              {currentWorkspace.path}
            </Text>
          )}
        </Flex>
      </Flex>
      <Divider style={{ margin: '8px 0' }} />
      <Button
        type="text"
        icon={<SwapOutlined />}
        block
        style={{ justifyContent: 'flex-start' }}
        onClick={() => setShowWorkspaceList(true)}
      >
        切换工作区
      </Button>
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

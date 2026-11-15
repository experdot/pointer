import { t, useI18n } from '@renderer/i18n'
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

function getWorkspaceName(workspace: WorkspaceSummary): string {
  return workspace.usesDefaultName ? t('defaults.workspace') : workspace.name
}

interface WorkspaceCardProps {
  onClose: () => void
}

export function WorkspaceCard({ onClose }: WorkspaceCardProps): React.JSX.Element {
  useI18n()

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
      message.error(error instanceof Error ? error.message : t('workspace.switchFailed'))
      console.error('Failed to switch workspace:', error)
    } finally {
      setSwitching(false)
    }
  }

  const handleOpenFolder = async (): Promise<void> => {
    if (switching) return
    try {
      const selectedPath = await pickWorkspaceDirectory(t('workspace.selectFolder'))
      if (!selectedPath) return

      try {
        if (!(await runSaved(() => openFolderAsWorkspace(selectedPath)))) return
      } catch (error) {
        const validation = await validateWorkspacePath(selectedPath).catch(() => null)
        if (validation?.repairable) {
          modal.confirm({
            title: t('workspace.needsRepair'),
            content: t('workspace.repairDescription'),
            okText: t('workspace.repairOpen'),
            cancelText: t('common.cancel'),
            onOk: async () => {
              try {
                if (!(await runSaved(() => repairWorkspacePath(selectedPath)))) return
                if (await runSaved(() => openFolderAsWorkspace(selectedPath))) onClose()
              } catch (repairError) {
                const repairMessage =
                  repairError instanceof Error ? repairError.message : t('workspace.repairFailed')
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
      const errorMessage = error instanceof Error ? error.message : t('workspace.openFailed')
      if (errorMessage.includes('locked by another account')) {
        message.error(t('workspace.folderInUse'))
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
      message.warning(t('workspace.noneToOpen'))
      return
    }

    try {
      void workspacePath
      await openWorkspaceInFileManager()
    } catch (error) {
      message.error(t('workspace.openFailed'))
      console.error('Failed to open workspace in file manager:', error)
    }
  }

  const handleDeleteWorkspace = async (
    workspace: WorkspaceSummary,
    e: React.MouseEvent
  ): Promise<void> => {
    e.stopPropagation()
    if (workspace.type === 'default') {
      message.warning(t('workspace.cannotDeleteDefault'))
      return
    }

    modal.confirm({
      title: t('workspace.remove'),
      content: t('workspace.removeConfirm', { v0: getWorkspaceName(workspace) }),
      okText: t('common.remove'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          if (await runSaved(() => deleteWorkspace(workspace.id)))
            message.success(t('workspace.removed'))
        } catch (error) {
          message.error(t('workspace.removeFailed'))
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
            {currentWorkspace ? getWorkspaceName(currentWorkspace) : t('workspace.notSelected')}
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
        <Tooltip title={t('workspace.openInExplorer')}>
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
      <Text type="secondary">{t('workspace.switch')}</Text>
      <List
        size="small"
        style={{
          maxHeight: 'min(320px, calc(100vh - 240px))',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
        dataSource={workspaces.filter((workspace) => workspace.id !== currentWorkspaceId)}
        locale={{ emptyText: t('workspace.noOthers') }}
        renderItem={(workspace) => (
          <List.Item
            className="workspace-card__item"
            style={{ padding: '8px', cursor: 'pointer' }}
            onClick={() => handleSwitchWorkspace(workspace.id)}
          >
            <Flex align="center" gap={8} flex={1} style={{ minWidth: 0 }}>
              <FolderOutlined style={{ fontSize: 16 }} />
              <Flex vertical flex={1} style={{ overflow: 'hidden' }}>
                <Text ellipsis>{getWorkspaceName(workspace)}</Text>
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
        {t('workspace.openFolder')}
      </Button>
    </Flex>
  )
}

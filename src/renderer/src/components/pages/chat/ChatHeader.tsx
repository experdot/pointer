import React, { useState, useMemo } from 'react'
import { Button, Dropdown, Space, App } from 'antd'
import { ExportOutlined, DownOutlined, UpOutlined, BranchesOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { ChatMessage } from '../../../types/type'
import { MessageTree } from './messageTree'
import { formatExactDateTime } from '../../../utils/timeFormatter'
import ExportModal, { ExportSettings } from './ExportModal'

interface ChatHeaderProps {
  chatId: string
  chatTitle?: string
  messages: ChatMessage[]
  currentPath?: string[]
  // 消息折叠相关
  allMessagesCollapsed?: boolean
  onCollapseAll?: () => void
  onExpandAll?: () => void
  // 消息树相关
  messageTreeCollapsed?: boolean
  onToggleMessageTree?: () => void
  // LLM配置
  llmConfigs?: Array<{ id: string; name: string }>
}

export default function ChatHeader({
  chatTitle,
  messages,
  currentPath = [],
  onCollapseAll,
  onExpandAll,
  messageTreeCollapsed = false,
  onToggleMessageTree,
  llmConfigs = []
}: ChatHeaderProps) {
  const [isExportModalVisible, setIsExportModalVisible] = useState(false)
  const [selectMode, setSelectMode] = useState<'all' | 'current-path'>('current-path')
  const { message } = App.useApp()

  // 创建消息树实例
  const messageTree = useMemo(() => {
    return new MessageTree(messages)
  }, [messages])

  // 获取当前路径的消息
  const currentPathMessages = useMemo(() => {
    if (currentPath.length > 0) {
      return currentPath
        .map((id) => messages.find((msg) => msg.id === id))
        .filter(Boolean) as ChatMessage[]
    } else {
      return messageTree.getCurrentPathMessages()
    }
  }, [messages, currentPath, messageTree])

  const exportOptions: MenuProps['items'] = [
    {
      key: 'current-path',
      label: '导出当前对话路径',
      onClick: () => {
        setSelectMode('current-path')
        setIsExportModalVisible(true)
      }
    },
    {
      key: 'all-messages',
      label: '导出所有消息',
      onClick: () => {
        setSelectMode('all')
        setIsExportModalVisible(true)
      }
    }
  ]

  const handleExport = async (selectedMessageIds: string[], exportSettings: ExportSettings) => {
    if (selectedMessageIds.length === 0) {
      message.warning('请选择要导出的消息')
      return
    }

    try {
      const selectedMessages = messages.filter((msg) => selectedMessageIds.includes(msg.id))

      // 根据时间戳排序消息
      selectedMessages.sort((a, b) => a.timestamp - b.timestamp)

      // 生成导出内容
      let exportContent = `# ${chatTitle || '聊天记录'}\n\n`
      exportContent += `导出时间: ${formatExactDateTime(Date.now())}\n`
      exportContent += `消息数量: ${selectedMessages.length}\n\n`
      exportContent += '---\n\n'

      selectedMessages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '用户' : 'AI助手'
        const timestamp = exportSettings.includeTimestamp ? formatExactDateTime(msg.timestamp) : ''
        const getModelDisplayName = (modelId?: string) => {
          if (!modelId) return ''
          const config = llmConfigs.find(config => config.id === modelId)
          return config?.name || modelId
        }
        const model = exportSettings.includeModelName && msg.modelId ? ` (${getModelDisplayName(msg.modelId)})` : ''

        exportContent += `## ${index + 1}. ${role}${model}\n`
        if (exportSettings.includeTimestamp) {
          exportContent += `时间: ${timestamp}\n\n`
        } else {
          exportContent += '\n'
        }

        if (msg.reasoning_content) {
          exportContent += `**思考过程:**\n${msg.reasoning_content}\n\n`
        }

        exportContent += `${msg.content}\n\n`
        exportContent += '---\n\n'
      })

      // 使用 Electron 的文件系统API保存文件
      const fileName = `${chatTitle || '聊天记录'}_${new Date().toISOString().slice(0, 10)}.txt`

      // 调用主进程保存文件
      const result = await window.api.saveFile({
        content: exportContent,
        defaultPath: fileName,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.success) {
        message.success(`导出成功: ${result.filePath}`)
        setIsExportModalVisible(false)
      } else if (result.cancelled) {
        // 用户取消了保存
      } else {
        message.error(`导出失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      message.error('导出失败，请重试')
    }
  }


  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          <h3 className="chat-title">{chatTitle || '未命名聊天'}</h3>
        </div>
        <div className="chat-header-right">
          <Space>
            {/* 消息树切换按钮 */}
            {onToggleMessageTree && (
              <Button
                type="text"
                size="small"
                icon={<BranchesOutlined />}
                onClick={onToggleMessageTree}
                title={messageTreeCollapsed ? '展开消息树' : '收起消息树'}
              >
                消息树
              </Button>
            )}
            {/* 消息折叠/展开按钮 */}
            {messages.length > 0 && (
              <>
                <Button
                  type="text"
                  size="small"
                  icon={<DownOutlined />}
                  onClick={onCollapseAll}
                  title="折叠全部消息"
                >
                  折叠全部
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<UpOutlined />}
                  onClick={onExpandAll}
                  title="展开全部消息"
                >
                  展开全部
                </Button>
              </>
            )}
            <Dropdown menu={{ items: exportOptions }} trigger={['click']}>
              <Button icon={<ExportOutlined />} type="text">
                导出
              </Button>
            </Dropdown>
          </Space>
        </div>
      </div>

      <ExportModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
        chatTitle={chatTitle}
        messages={messages}
        currentPathMessages={currentPathMessages}
        selectMode={selectMode}
        onExport={handleExport}
        llmConfigs={llmConfigs}
      />
    </>
  )
}

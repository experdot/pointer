import React, { useState, useMemo } from 'react'
import { Modal, Checkbox, Space, Button, App, Divider } from 'antd'
import { ChatMessage } from '../../../types/type'
import { formatExactDateTime } from '../../../utils/timeFormatter'

interface ExportModalProps {
  visible: boolean
  onClose: () => void
  chatTitle?: string
  messages: ChatMessage[]
  currentPathMessages: ChatMessage[]
  selectMode: 'all' | 'current-path'
  onExport: (selectedIds: string[], settings: ExportSettings) => void
  llmConfigs?: Array<{ id: string; name: string }>
}

export interface ExportSettings {
  includeModelName: boolean
  includeTimestamp: boolean
  includeReasoningContent: boolean
}

export default function ExportModal({
  visible,
  onClose,
  chatTitle,
  messages,
  currentPathMessages,
  selectMode,
  onExport,
  llmConfigs = []
}: ExportModalProps) {
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeModelName: true,
    includeTimestamp: true,
    includeReasoningContent: false
  })

  const { message } = App.useApp()

  const getModelDisplayName = (modelId?: string) => {
    if (!modelId) return ''
    const config = llmConfigs.find(config => config.id === modelId)
    return config?.name || modelId
  }

  const availableMessages = useMemo(() => {
    return selectMode === 'all' ? messages : currentPathMessages
  }, [selectMode, messages, currentPathMessages])

  const handleMessageToggle = (messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    )
  }

  const handleSelectAll = () => {
    setSelectedMessageIds(availableMessages.map((msg) => msg.id))
  }

  const handleSelectNone = () => {
    setSelectedMessageIds([])
  }

  const handleExport = () => {
    if (selectedMessageIds.length === 0) {
      message.warning('请选择要导出的消息')
      return
    }
    onExport(selectedMessageIds, exportSettings)
  }

  const handleCancel = () => {
    setSelectedMessageIds([])
    onClose()
  }


  return (
    <Modal
      title="导出聊天记录"
      open={visible}
      onOk={handleExport}
      onCancel={handleCancel}
      width={800}
      okText="导出"
      cancelText="取消"
    >
      <div style={{ marginBottom: 16 }}>
        <p>
          {selectMode === 'current-path' && '当前对话路径模式：显示当前选择的对话分支'}
          {selectMode === 'all' && '所有消息模式：显示聊天中的所有消息'}
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
        <h4>导出选项：</h4>
          <Checkbox
            checked={exportSettings.includeModelName}
            onChange={(e) =>
              setExportSettings(prev => ({ ...prev, includeModelName: e.target.checked }))
            }
          >
            包含模型名称
          </Checkbox>
          <Checkbox
            checked={exportSettings.includeTimestamp}
            onChange={(e) =>
              setExportSettings(prev => ({ ...prev, includeTimestamp: e.target.checked }))
            }
          >
            包含时间戳
          </Checkbox>
          <Checkbox
            checked={exportSettings.includeReasoningContent}
            onChange={(e) =>
              setExportSettings(prev => ({ ...prev, includeReasoningContent: e.target.checked }))
            }
          >
            包含思考过程
          </Checkbox>
        </Space>
      </div>

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button size="small" onClick={handleSelectAll}>
            全选
          </Button>
          <Button size="small" onClick={handleSelectNone}>
            取消全选
          </Button>
          <span>已选择: {selectedMessageIds.length} 条消息</span>
        </Space>
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {availableMessages.map((msg) => {
          const isSelected = selectedMessageIds.includes(msg.id)
          const role = msg.role === 'user' ? '用户' : 'AI助手'
          const timestamp = formatExactDateTime(msg.timestamp)
          const preview = msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : '')

          return (
            <div key={msg.id} style={{ marginBottom: 8 }}>
              <Checkbox checked={isSelected} onChange={() => handleMessageToggle(msg.id)}>
                <div>
                  <div>
                    <span>{role}</span>
                    {exportSettings.includeTimestamp && <span style={{ marginLeft: 8, color: '#666' }}>{timestamp}</span>}
                    {exportSettings.includeModelName && msg.modelId && <span style={{ marginLeft: 8, color: '#666' }}>({getModelDisplayName(msg.modelId)})</span>}
                  </div>
                  <div style={{ color: '#666', marginTop: 4 }}>{preview}</div>
                </div>
              </Checkbox>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
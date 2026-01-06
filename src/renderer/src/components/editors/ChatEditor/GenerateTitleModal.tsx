import React, { useState, useCallback, useEffect } from 'react'
import { Modal, Input, Button } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { ModelSelector } from './ModelSelector'
import { ModelConfigSelector } from './ModelConfigSelector'
import './GenerateTitleModal.css'

const { TextArea } = Input

export type GenerateMode = 'title' | 'topic' | 'batch-title' | 'smart-segment' | 'session-title'

export interface GenerateOptions {
  extraRequirements?: string
  llmId?: string
  modelConfigId?: string
}

interface GenerateTitleModalProps {
  open: boolean
  onClose: () => void
  mode: GenerateMode
  messageId?: string
  onGenerate: (options: GenerateOptions) => Promise<void>
}

const MODE_TITLES: Record<GenerateMode, string> = {
  title: '生成标题',
  topic: '生成 Topic',
  'batch-title': '批量生成标题',
  'smart-segment': '智能分段',
  'session-title': '生成对话标题'
}

const MODE_PLACEHOLDERS: Record<GenerateMode, string> = {
  title: '输入额外要求（可选），如：使用英文、不超过5个字...',
  topic: '输入额外要求（可选），如：突出关键词、使用动词开头...',
  'batch-title': '输入额外要求（可选），将应用于所有消息...',
  'smart-segment': '输入额外要求（可选），如：更细粒度分段、合并相似话题...',
  'session-title': '输入额外要求（可选），如：简洁概括、突出主题...'
}

export function GenerateTitleModal({
  open,
  onClose,
  mode,
  onGenerate
}: GenerateTitleModalProps): React.JSX.Element {
  const [extraRequirements, setExtraRequirements] = useState('')
  const [llmId, setLlmId] = useState<string | undefined>(undefined)
  const [modelConfigId, setModelConfigId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setExtraRequirements('')
      setLlmId(undefined)
      setModelConfigId(undefined)
    }
  }, [open])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    try {
      await onGenerate({
        extraRequirements: extraRequirements.trim() || undefined,
        llmId,
        modelConfigId
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }, [extraRequirements, llmId, modelConfigId, onGenerate, onClose])

  // Enter 快捷键发送（Shift+Enter 换行）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !loading) {
        e.preventDefault()
        handleGenerate()
      }
    },
    [handleGenerate, loading]
  )

  return (
    <Modal
      title={MODE_TITLES[mode]}
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <div className="generate-modal__content">
        <TextArea
          value={extraRequirements}
          onChange={(e) => setExtraRequirements(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={MODE_PLACEHOLDERS[mode]}
          autoSize={{ minRows: 2, maxRows: 6 }}
          autoFocus
          disabled={loading}
        />
        <div className="generate-modal__toolbar">
          <div className="generate-modal__toolbar-left">
            <ModelSelector value={llmId} onChange={setLlmId} disabled={loading} />
            <ModelConfigSelector value={modelConfigId} onChange={setModelConfigId} disabled={loading} />
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleGenerate}
            loading={loading}
          >
            生成
          </Button>
        </div>
      </div>
    </Modal>
  )
}

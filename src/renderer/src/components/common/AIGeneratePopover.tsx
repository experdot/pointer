import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Popover, Input, Button, type PopoverProps } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { ModelSelector } from '../editors/ChatEditor/ModelSelector'
import { ModelConfigSelector } from '../editors/ChatEditor/ModelConfigSelector'
import { useSettingsStore } from '../../stores/settingsStore'
import { openSettings } from '../../services/settingsService'
import './AIGeneratePopover.css'

const { TextArea } = Input

export type GenerateMode = 'title' | 'topic' | 'batch-title' | 'smart-segment' | 'session-title'

export interface GenerateOptions {
  extraRequirements?: string
  llmId?: string
  modelConfigId?: string
}

interface AIGeneratePopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: GenerateMode
  onGenerate: (options: GenerateOptions) => Promise<void>
  children: React.ReactElement
  placement?: PopoverProps['placement']
  /** 自定义渲染容器，用于解决层级问题 */
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
}

const MODE_PLACEHOLDERS: Record<GenerateMode, string> = {
  title: '额外要求（可选），如：使用英文、不超过5个字...',
  topic: '额外要求（可选），如：突出关键词、使用动词开头...',
  'batch-title': '额外要求（可选），将应用于所有消息...',
  'smart-segment': '额外要求（可选），如：更细粒度分段、合并相似话题...',
  'session-title': '额外要求（可选），如：简洁概括、突出主题...'
}

export function AIGeneratePopover({
  open,
  onOpenChange,
  mode,
  onGenerate,
  children,
  placement = 'bottomLeft',
  getPopupContainer
}: AIGeneratePopoverProps): React.JSX.Element {
  const [extraRequirements, setExtraRequirements] = useState('')
  const [llmId, setLlmId] = useState<string | undefined>(undefined)
  const [modelConfigId, setModelConfigId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 检查 LLM 配置状态
  const { settings } = useSettingsStore()
  const hasLLMConfig = settings.llmConfigs.items.length > 0
  const hasDefaultLLM = settings.defaultLLMId !== undefined

  // 打开时重置状态并聚焦
  useEffect(() => {
    if (open) {
      setExtraRequirements('')
      setLlmId(undefined)
      setModelConfigId(undefined)
      // 延迟聚焦，等待 Popover 渲染完成
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
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
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }, [extraRequirements, llmId, modelConfigId, onGenerate, onOpenChange])

  // Enter 快捷键发送（Shift+Enter 换行）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !loading) {
        e.preventDefault()
        handleGenerate()
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    },
    [handleGenerate, loading, onOpenChange]
  )

  // 是否需要显示覆盖层
  const needsOverlay = !hasLLMConfig || !hasDefaultLLM

  // 覆盖层提示内容
  const renderOverlay = (): React.ReactNode => {
    if (!hasLLMConfig) {
      return (
        <span className="ai-generate-popover__no-config-text">
          未配置模型，请先
          <a
            onClick={() => {
              onOpenChange(false)
              openSettings('llm')
            }}
          >
            配置 LLM
          </a>
        </span>
      )
    }
    if (!hasDefaultLLM) {
      return (
        <span className="ai-generate-popover__no-config-text">请先在下方选择一个模型</span>
      )
    }
    return null
  }

  const content = (
    <div className="ai-generate-popover__content" onClick={(e) => e.stopPropagation()}>
      <div className="ai-generate-popover__textarea-wrapper">
        <TextArea
          ref={textareaRef}
          value={extraRequirements}
          onChange={(e) => setExtraRequirements(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={MODE_PLACEHOLDERS[mode]}
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={loading || needsOverlay}
        />
        {/* 提示覆盖层 */}
        {needsOverlay && (
          <div className="ai-generate-popover__overlay">{renderOverlay()}</div>
        )}
      </div>
      <div className="ai-generate-popover__toolbar">
        <div className="ai-generate-popover__toolbar-left">
          <ModelSelector value={llmId} onChange={setLlmId} disabled={loading} />
          <ModelConfigSelector
            value={modelConfigId}
            onChange={setModelConfigId}
            disabled={loading}
          />
        </div>
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          onClick={handleGenerate}
          loading={loading}
          disabled={needsOverlay}
        >
          生成
        </Button>
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={onOpenChange}
      placement={placement}
      arrow={false}
      destroyTooltipOnHide
      zIndex={1100}
      getPopupContainer={getPopupContainer}
    >
      {children}
    </Popover>
  )
}

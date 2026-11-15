import { t, useI18n } from '@renderer/i18n'
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Popover, Input, Button, type PopoverProps } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { ModelSelector } from '../editors/ChatEditor/ModelSelector'
import { ModelConfigSelector } from '../editors/ChatEditor/ModelConfigSelector'
import { useSettingsStore } from '../../stores/settingsStore'
import { openSettings } from '../../services/settingsService'
import './AIGeneratePopover.css'

const { TextArea } = Input

type GenerateMode = 'title' | 'topic' | 'batch-title' | 'smart-segment' | 'session-title'

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
  get title(): string {
    return t('ai.requirements.title')
  },
  get topic(): string {
    return t('ai.requirements.topic')
  },
  get 'batch-title'() {
    return t('ai.requirements.all')
  },
  get 'smart-segment'() {
    return t('ai.requirements.segment')
  },
  get 'session-title'() {
    return t('ai.requirements.session')
  }
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
  useI18n()

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
          {t('ai.notConfigured')}
          <a
            onClick={() => {
              onOpenChange(false)
              openSettings('llm')
            }}
          >
            {t('ai.configure')}
          </a>
        </span>
      )
    }
    if (!hasDefaultLLM) {
      return <span className="ai-generate-popover__no-config-text">{t('ai.selectFirst')}</span>
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
        {needsOverlay && <div className="ai-generate-popover__overlay">{renderOverlay()}</div>}
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
          {t('ai.generate')}
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

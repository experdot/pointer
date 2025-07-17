import React, { useRef, forwardRef, useImperativeHandle } from 'react'
import { Input, Button, Alert } from 'antd'
import { SendOutlined, StopOutlined, SettingOutlined } from '@ant-design/icons'
import { LLMConfig } from '../../../types/type'
import ModelSelector from './ModelSelector'

const { TextArea } = Input

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop?: () => void
  disabled: boolean
  loading: boolean
  llmConfigs: LLMConfig[]
  selectedModel?: string
  defaultModelId?: string
  onModelChange: (modelId: string) => void
  onOpenSettings?: () => void
}

export interface ChatInputRef {
  focus: () => void
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSend,
      onStop,
      disabled,
      loading,
      llmConfigs,
      selectedModel,
      defaultModelId,
      onModelChange,
      onOpenSettings
    },
    ref
  ) => {
    const textAreaRef = useRef<any>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        textAreaRef.current?.focus()
      }
    }))

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    }

    const hasNoModels = !llmConfigs || llmConfigs.length === 0
    const hasNoSelectedModel = !selectedModel

    return (
      <div className="chat-input-area">
        {/* 当没有模型配置时显示警告 */}
        {hasNoModels && (
          <Alert
            message="尚未配置AI模型"
            description={
              <div>
                您需要先配置AI模型才能开始对话。
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={onOpenSettings}
                  style={{ padding: '0 4px', marginLeft: 8 }}
                >
                  立即配置
                </Button>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        {/* 当有模型但没有选中时显示提示 */}
        {!hasNoModels && hasNoSelectedModel && (
          <Alert
            message="请选择一个AI模型"
            description="您需要在模型选择器中选择一个AI模型才能发送消息。"
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        <div className="chat-input-container">
          <ModelSelector
            llmConfigs={llmConfigs}
            selectedModel={selectedModel}
            onChange={onModelChange}
            disabled={disabled || loading}
            size="small"
          />
          <TextArea
            ref={textAreaRef}
            placeholder={
              hasNoModels
                ? '请先配置AI模型...'
                : hasNoSelectedModel
                  ? '请先选择模型...'
                  : '输入消息... (Enter发送，Shift+Enter换行)'
            }
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={disabled || hasNoModels}
          />
          {loading ? (
            <Button type="primary" danger icon={<StopOutlined />} onClick={onStop}>
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={onSend}
              disabled={!value.trim() || disabled || !selectedModel || hasNoModels}
            >
              发送
            </Button>
          )}
        </div>
      </div>
    )
  }
)

export default ChatInput

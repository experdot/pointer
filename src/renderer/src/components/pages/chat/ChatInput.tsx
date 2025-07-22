import React, { useRef, forwardRef, useImperativeHandle, useState } from 'react'
import { Input, Button, Alert, Switch, Tooltip, Space, Select, Dropdown, Flex } from 'antd'
import {
  SendOutlined,
  StopOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  BulbOutlined,
  DownOutlined,
  PlaySquareOutlined
} from '@ant-design/icons'
import { LLMConfig } from '../../../types/type'
import { useSettingsStore } from '../../../stores/settingsStore'
import ModelSelector from './ModelSelector'

const { TextArea } = Input
const { Option } = Select

// 自动提问控件组件
interface AutoQuestionControlsProps {
  enabled: boolean
  mode: 'ai' | 'preset'
  selectedListId?: string
  promptLists: any[]
  disabled: boolean
  onChange?: (enabled: boolean, mode: 'ai' | 'preset', listId?: string) => void
}

function AutoQuestionControls({
  enabled,
  mode,
  selectedListId,
  promptLists,
  disabled,
  onChange
}: AutoQuestionControlsProps) {
  const handleEnabledChange = (checked: boolean) => {
    let finalListId = selectedListId
    // 如果开启自动提问且是预设模式，但没有选择列表，使用第一个可用列表
    if (checked && mode === 'preset' && !selectedListId && promptLists.length > 0) {
      finalListId = promptLists[0].id
    }
    console.log('AutoQuestionControls handleEnabledChange:', {
      checked,
      mode,
      selectedListId,
      finalListId,
      promptListsLength: promptLists.length
    })
    onChange?.(checked, mode, finalListId)
  }

  const handleModeChange = (newMode: 'ai' | 'preset') => {
    onChange?.(
      enabled,
      newMode,
      newMode === 'preset' ? selectedListId || promptLists[0]?.id : undefined
    )
  }

  const handleListChange = (listId: string) => {
    onChange?.(enabled, mode, listId)
  }

  const getCurrentPromptList = () => {
    return promptLists.find((list) => list.id === selectedListId)
  }

  const modeOptions = [
    {
      key: 'ai',
      label: (
        <Space>
          <QuestionCircleOutlined />
          AI自动追问
        </Space>
      )
    },
    {
      key: 'preset',
      label: (
        <Space>
          <BulbOutlined />
          预设列表提问
        </Space>
      )
    }
  ]

  const dropdownMenu = {
    items: modeOptions.map((option) => ({
      key: option.key,
      label: option.label,
      onClick: () => handleModeChange(option.key as 'ai' | 'preset')
    }))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Tooltip title="开启后，AI回答完成将自动继续提问">
        <Space align="center" size="small">
          <Switch
            size="small"
            checked={enabled}
            onChange={handleEnabledChange}
            disabled={disabled}
          />
          <span style={{ fontSize: '12px' }}>自动提问</span>
        </Space>
      </Tooltip>

      {enabled && (
        <>
          <Dropdown menu={dropdownMenu} trigger={['click']} disabled={disabled}>
            <Button size="small" style={{ fontSize: '11px' }}>
              {mode === 'ai' ? (
                <Space size={4}>
                  <QuestionCircleOutlined />
                  AI追问
                </Space>
              ) : (
                <Space size={4}>
                  <BulbOutlined />
                  预设列表
                </Space>
              )}
              <DownOutlined />
            </Button>
          </Dropdown>

          {mode === 'preset' && (
            <Select
              size="small"
              value={selectedListId}
              onChange={handleListChange}
              placeholder="选择列表"
              style={{ minWidth: 120, fontSize: '11px' }}
              disabled={disabled || promptLists.length === 0}
            >
              {promptLists.map((list) => (
                <Option key={list.id} value={list.id}>
                  {list.name}
                </Option>
              ))}
            </Select>
          )}
        </>
      )}
    </div>
  )
}

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
  // 自动提问相关
  autoQuestionEnabled?: boolean
  autoQuestionMode?: 'ai' | 'preset'
  autoQuestionListId?: string
  onAutoQuestionChange?: (enabled: boolean, mode: 'ai' | 'preset', listId?: string) => void
  onTriggerFollowUpQuestion?: () => Promise<void>
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
      onOpenSettings,
      autoQuestionEnabled = false,
      autoQuestionMode = 'ai',
      autoQuestionListId,
      onAutoQuestionChange,
      onTriggerFollowUpQuestion
    },
    ref
  ) => {
    const textAreaRef = useRef<any>(null)
    const { settings } = useSettingsStore()

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

        <div
          className="chat-input-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            flexWrap: 'wrap'
          }}
        >
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
            autoSize={{ minRows: 1, maxRows: 10 }}
            disabled={disabled || hasNoModels}
          />
          <Flex align="center" gap={8} justify="space-between" style={{ width: '100%' }}>
            <Space>
              {/* 模型选择器 */}
              <div>
                <ModelSelector
                  llmConfigs={llmConfigs}
                  selectedModel={selectedModel}
                  defaultLLMId={defaultModelId}
                  onChange={onModelChange}
                  disabled={disabled}
                  size="small"
                />
              </div>

              {/* 自动提问控件 */}
              <div>
                <AutoQuestionControls
                  enabled={autoQuestionEnabled}
                  mode={autoQuestionMode}
                  selectedListId={autoQuestionListId}
                  promptLists={settings.promptLists || []}
                  disabled={false}
                  onChange={onAutoQuestionChange}
                />
              </div>

              {/* 立即追问按钮 */}
              {autoQuestionEnabled && (
                <Tooltip title={`立即触发一次${autoQuestionMode === 'ai' ? 'AI' : '预设列表'}追问`}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlaySquareOutlined />}
                    onClick={async () => {
                      try {
                        await onTriggerFollowUpQuestion?.()
                      } catch (error) {
                        console.error('立即追问失败:', error)
                      }
                    }}
                    disabled={disabled || loading}
                    style={{ fontSize: '11px', color: '#1890ff' }}
                  >
                    立即追问
                  </Button>
                </Tooltip>
              )}
            </Space>

            {/* 发送/停止按钮 */}
            <div style={{ justifySelf: 'flex-end' }}>
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
          </Flex>
        </div>
      </div>
    )
  }
)

export default ChatInput

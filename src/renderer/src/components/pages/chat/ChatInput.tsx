import React, { useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react'
import { Input, Button, Alert, Switch, Tooltip, Space, Select, Dropdown, Flex, Badge, Upload, Image, Tag } from 'antd'
import {
  SendOutlined,
  StopOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  BulbOutlined,
  DownOutlined,
  PlaySquareOutlined,
  HourglassOutlined,
  PlusOutlined,
  CaretRightOutlined,
  PaperClipOutlined,
  CloseOutlined,
  FileImageOutlined
} from '@ant-design/icons'
import { LLMConfig, FileAttachment } from '../../../types/type'
import { useSettingsStore } from '../../../stores/settingsStore'
import ModelSelector from './ModelSelector'
import { v4 as uuidv4 } from 'uuid'

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
  // 消息队列相关
  queueEnabled?: boolean
  queuePendingCount?: number
  queuePaused?: boolean
  queueAutoProcess?: boolean
  onToggleQueuePanel?: () => void
  onResumeQueue?: () => void
  // 文件附件相关
  attachments?: FileAttachment[]
  onAttachmentsChange?: (attachments: FileAttachment[]) => void
}

export interface ChatInputRef {
  focus: () => void
  insertQuote: (text: string) => void
}

const ChatInput = React.memo(forwardRef<ChatInputRef, ChatInputProps>(
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
      onTriggerFollowUpQuestion,
      queueEnabled = false,
      queuePendingCount = 0,
      queuePaused = false,
      queueAutoProcess = true,
      onToggleQueuePanel,
      onResumeQueue,
      attachments = [],
      onAttachmentsChange
    },
    ref
  ) => {
    const textAreaRef = useRef<any>(null)
    const isComposingRef = useRef(false)
    const { settings } = useSettingsStore()
    const [isSelectingFile, setIsSelectingFile] = useState(false)

    const insertQuote = useCallback((text: string) => {
      const currentValue = value
      const newValue = currentValue ? `${currentValue}\n\n${text}\n\n` : `${text}\n\n`
      onChange(newValue)

      // 聚焦到输入框并将光标移到末尾
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus()
          const textarea = textAreaRef.current.resizableTextArea?.textArea || textAreaRef.current
          if (textarea) {
            textarea.setSelectionRange(newValue.length, newValue.length)
          }
        }
      }, 100)
    }, [value, onChange])

    useImperativeHandle(ref, () => ({
      focus: () => {
        textAreaRef.current?.focus()
      },
      insertQuote
    }))

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
        e.preventDefault()
        onSend()
      }
    }, [onSend])

    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    }, [onChange])

    const handleCompositionStart = useCallback(() => {
      isComposingRef.current = true
    }, [])

    const handleCompositionEnd = useCallback(() => {
      isComposingRef.current = false
    }, [])

    // 处理文件选择
    const handleSelectFiles = useCallback(async () => {
      try {
        setIsSelectingFile(true)
        const result = await window.api.selectFiles({
          multiple: true,
          filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.success && result.files) {
          const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
          const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']

          const newAttachments: FileAttachment[] = []
          const errors: string[] = []

          for (const file of result.files) {
            // 文件大小验证
            if (file.size > MAX_FILE_SIZE) {
              errors.push(`${file.name}: 文件大小超过 10MB 限制`)
              continue
            }

            // 获取 MIME 类型
            const ext = file.name.split('.').pop()?.toLowerCase()
            let mimeType = 'application/octet-stream'

            if (['jpg', 'jpeg'].includes(ext || '')) mimeType = 'image/jpeg'
            else if (ext === 'png') mimeType = 'image/png'
            else if (ext === 'gif') mimeType = 'image/gif'
            else if (ext === 'bmp') mimeType = 'image/bmp'
            else if (ext === 'webp') mimeType = 'image/webp'

            // 文件类型验证
            if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
              errors.push(`${file.name}: 不支持的文件类型，仅支持图片格式`)
              continue
            }

            const attachment: FileAttachment = {
              id: uuidv4(),
              name: file.name,
              type: mimeType,
              size: file.size,
              content: file.content,
              url: mimeType.startsWith('image/') ? `data:${mimeType};base64,${file.content}` : undefined
            }
            newAttachments.push(attachment)
          }

          if (errors.length > 0) {
            const { message } = await import('antd/es')
            errors.forEach(err => message.error(err))
          }

          if (newAttachments.length > 0) {
            onAttachmentsChange?.([...attachments, ...newAttachments])
          }
        }
      } catch (error) {
        console.error('文件选择失败:', error)
        const { message } = await import('antd/es')
        message.error('文件选择失败，请重试')
      } finally {
        setIsSelectingFile(false)
      }
    }, [attachments, onAttachmentsChange])

    // 移除附件
    const handleRemoveAttachment = useCallback((attachmentId: string) => {
      onAttachmentsChange?.(attachments.filter(att => att.id !== attachmentId))
    }, [attachments, onAttachmentsChange])

    // 处理粘贴事件
    const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageItems: DataTransferItem[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          imageItems.push(items[i])
        }
      }

      if (imageItems.length === 0) return

      // 阻止默认粘贴行为（对于图片）
      e.preventDefault()

      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
      const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']

      const newAttachments: FileAttachment[] = []
      const errors: string[] = []

      for (const item of imageItems) {
        const file = item.getAsFile()
        if (!file) continue

        // 文件大小验证
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name || '粘贴的图片'}: 文件大小超过 10MB 限制`)
          continue
        }

        // 文件类型验证
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          errors.push(`${file.name || '粘贴的图片'}: 不支持的文件类型`)
          continue
        }

        // 读取文件内容为 base64
        try {
          const base64Content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              // 移除 data URL 前缀，只保留 base64 部分
              const base64 = result.split(',')[1]
              resolve(base64)
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })

          const attachment: FileAttachment = {
            id: uuidv4(),
            name: file.name || `粘贴的图片-${Date.now()}.${file.type.split('/')[1]}`,
            type: file.type,
            size: file.size,
            content: base64Content,
            url: `data:${file.type};base64,${base64Content}`
          }
          newAttachments.push(attachment)
        } catch (error) {
          console.error('读取粘贴图片失败:', error)
          errors.push(`${file.name || '粘贴的图片'}: 读取失败`)
        }
      }

      if (errors.length > 0) {
        const { message } = await import('antd/es')
        errors.forEach(err => message.error(err))
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange?.([...attachments, ...newAttachments])
      }
    }, [attachments, onAttachmentsChange])

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

        {/* 文件附件预览 */}
        {attachments && attachments.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  padding: 4,
                  background: '#fafafa'
                }}
              >
                {attachment.type.startsWith('image/') && attachment.url ? (
                  <div style={{ position: 'relative' }}>
                    <Image
                      src={attachment.url}
                      alt={attachment.name}
                      width={80}
                      height={80}
                      style={{ objectFit: 'cover', borderRadius: 2 }}
                      preview={{
                        mask: <div style={{ fontSize: 12 }}>预览</div>
                      }}
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 20,
                        height: 20,
                        minWidth: 20,
                        padding: 0,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                    <div style={{ fontSize: 11, marginTop: 4, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachment.name}
                    </div>
                  </div>
                ) : (
                  <Space>
                    <FileImageOutlined />
                    <span style={{ fontSize: 12 }}>{attachment.name}</span>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => handleRemoveAttachment(attachment.id)}
                    />
                  </Space>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="chat-input-container">
          <TextArea
            ref={textAreaRef}
            placeholder={
              hasNoModels
                ? '请先配置AI模型...'
                : hasNoSelectedModel
                  ? '请先选择模型...'
                  : '输入消息... (Enter发送，Shift+Enter换行，支持粘贴图片)'
            }
            value={value}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onPaste={handlePaste}
            autoSize={{ minRows: 1, maxRows: 10 }}
            disabled={hasNoModels}
          />
          <Flex align="center" gap={8} justify="space-between" style={{ width: '100%' }}>
            <Space>
              {/* 文件上传按钮 */}
              <Tooltip title="上传图片">
                <Button
                  type="text"
                  size="small"
                  icon={<PaperClipOutlined />}
                  onClick={handleSelectFiles}
                  loading={isSelectingFile}
                  disabled={disabled || hasNoModels}
                />
              </Tooltip>

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

            {/* 发送/停止/队列按钮 */}
            <Space>
              {queueEnabled && (
                <>
                  {/* 队列面板切换按钮 */}
                  <Tooltip title="消息队列">
                    <Badge count={queuePendingCount} size="small" offset={[-5, 5]}>
                      <Button
                        icon={<HourglassOutlined />}
                        onClick={onToggleQueuePanel}
                      />
                    </Badge>
                  </Tooltip>
                </>
              )}

              {loading ? (
                <Button type="primary" danger icon={<StopOutlined />} onClick={onStop}>
                  停止
                </Button>
              ) : (!queueAutoProcess && queuePendingCount > 0) || (queuePaused && queuePendingCount > 0) ? (
                <Button
                  type="primary"
                  icon={<CaretRightOutlined />}
                  onClick={onResumeQueue}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                  继续队列
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={onSend}
                  disabled={(!value.trim() && attachments.length === 0) || disabled || !selectedModel || hasNoModels}
                >
                  发送
                </Button>
              )}
            </Space>
          </Flex>
        </div>
      </div>
    )
  }
))

export default ChatInput

import type { MenuProps, InputRef } from 'antd'
import type { ChatMessage, FileAttachment, Topic } from '../../../../types/type'
import type { GenerateOptions } from '../../../common/AIGeneratePopover'

// 右键菜单上下文信息
export interface ContextMenuInfo {
  type: 'default' | 'text' | 'code' | 'table'
  content?: string
  language?: string
}

// Topic 相关 callbacks
export interface TopicCallbacks {
  onCreateTopic?: (messageId: string, name: string) => void
  onUpdateTopic?: (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => void
  onDeleteTopic?: (topicId: string) => void
  onToggleTopicCollapse?: (topicId: string) => void
  onGenerateTopic?: (messageId: string, options: GenerateOptions) => Promise<void>
}

// 标题相关 callbacks
export interface TitleCallbacks {
  onUpdateTitle?: (messageId: string, title: string) => void
  onGenerateTitle?: (messageId: string, options: GenerateOptions) => Promise<void>
}

// 消息操作 callbacks
export interface MessageActionCallbacks {
  onRetry: (messageId: string, llmId?: string, modelConfigId?: string) => void
  onContinue: (messageId: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, content: string, attachments?: FileAttachment[]) => void
  onEditAndResend: (messageId: string, content: string, attachments?: FileAttachment[]) => void
  onSwitchBranch: (messageId: string) => void
  onQuote?: (text: string) => void
  onToggleCollapse?: (messageId: string) => void
}

// 导出相关 callbacks
export interface ExportCallbacks {
  onExport?: (messageId: string) => void
  onExportText?: (text: string) => void
  onExportCode?: (code: string, language: string) => void
  onExportTable?: (markdown: string) => void
}

// MessageItem 主组件 Props
export interface MessageItemProps {
  message: ChatMessage
  isLast?: boolean
  isLeaf?: boolean
  isStreaming?: boolean
  streamingContent?: string
  streamingReasoning?: string
  branchIndex: number
  branchCount: number
  siblings: ChatMessage[]
  // Topic 相关
  topic?: Topic
  topicMessageCount?: number
  // Callbacks 分组
  actionCallbacks: MessageActionCallbacks
  titleCallbacks: TitleCallbacks
  topicCallbacks: TopicCallbacks
  exportCallbacks: ExportCallbacks
}

// TopicHeader Props
export interface TopicHeaderProps {
  topic: Topic
  topicMessageCount?: number
  messageId: string
  displayContent: string
  isEditing: boolean
  editValue: string
  popoverOpen: boolean
  inputRef: React.RefObject<InputRef | null>
  onEditValueChange: (value: string) => void
  onStartEdit: () => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onPopoverOpenChange: (open: boolean) => void
  topicCallbacks: TopicCallbacks
}

// MessageHeader Props
export interface MessageHeaderProps {
  message: ChatMessage
  isUser: boolean
  isAssistant: boolean
  isStreaming?: boolean
  branchIndex: number
  branchCount: number
  siblings: ChatMessage[]
  onToggleCollapse?: (messageId: string) => void
  onRetry: (messageId: string, llmId?: string, modelConfigId?: string) => void
  onSwitchBranch: (messageId: string) => void
}

// TitleRow Props
export interface TitleRowProps {
  messageId: string
  title: string | undefined
  isEditing: boolean
  editValue: string
  popoverOpen: boolean
  inputRef: React.RefObject<InputRef | null>
  onEditValueChange: (value: string) => void
  onStartEdit: () => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onPopoverOpenChange: (open: boolean) => void
  titleCallbacks: TitleCallbacks
}

// ReasoningContent Props
export interface ReasoningContentProps {
  content: string
  expanded: boolean
  onToggle: () => void
}

// MessageEditMode Props
export interface MessageEditModeProps {
  content: string
  attachments: FileAttachment[]
  isUser: boolean
  onContentChange: (content: string) => void
  onAttachmentsChange: (attachments: FileAttachment[]) => void
  onCancel: () => void
  onSave: () => void
  onSaveAndResend?: () => void
}

// MessageViewMode Props
export interface MessageViewModeProps {
  displayContent: string
  isAssistant: boolean
  isStreaming?: boolean
  collapsed: boolean
  collapsedPreview: string
  contextMenuItems: MenuProps['items']
  onContextMenu: (e: React.MouseEvent) => void
  onExpandCollapsed: () => void
}

// MessageContent Props
export interface MessageContentProps {
  message: ChatMessage
  displayContent: string
  isUser: boolean
  isAssistant: boolean
  isStreaming?: boolean
  isEditing: boolean
  editContent: string
  editAttachments: FileAttachment[]
  collapsed: boolean
  collapsedPreview: string
  topic?: Topic
  onEditContentChange: (content: string) => void
  onEditAttachmentsChange: (attachments: FileAttachment[]) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onEditAndResend: () => void
  onToggleCollapse: () => void
  onStartTitleEdit: () => void
  onStartTopicEdit: () => void
  topicCallbacks: TopicCallbacks
  exportCallbacks: ExportCallbacks
  onQuote?: (text: string) => void
}

// MessageActions Props
export interface MessageActionsProps {
  isUser: boolean
  isAssistant: boolean
  isLeaf?: boolean
  copied: boolean
  onCopy: () => void
  onStartEdit: () => void
  onRetry: () => void
  onContinue: () => void
  onDelete: () => void
}

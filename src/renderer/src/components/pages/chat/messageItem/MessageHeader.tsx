import React from 'react'
import { Typography, Select, Button } from 'antd'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { LLMConfig } from '../../../../types/type'
import BranchNavigator from '../BranchNavigator'
import RelativeTime from '../../../common/RelativeTime'

const { Text } = Typography
const { Option } = Select

interface MessageHeaderProps {
  role: string
  modelId?: string
  timestamp: number
  isCollapsed: boolean
  isLoading: boolean
  llmConfigs: LLMConfig[]
  hasChildBranches: boolean
  branchIndex: number
  branchCount: number
  onModelChange: (modelId: string) => void
  onBranchPrevious: () => void
  onBranchNext: () => void
  onToggleCollapse: () => void
}

export const MessageHeader: React.FC<MessageHeaderProps> = ({
  role,
  modelId,
  timestamp,
  isCollapsed,
  isLoading,
  llmConfigs,
  hasChildBranches,
  branchIndex,
  branchCount,
  onModelChange,
  onBranchPrevious,
  onBranchNext,
  onToggleCollapse
}) => {
  return (
    <div className="message-header">
      <div className="message-title">
        <Text strong>{role === 'user' ? '您' : 'AI助手'}</Text>
        {role === 'assistant' && modelId && llmConfigs.length > 0 && (
          <Select
            value={modelId}
            onChange={onModelChange}
            size="small"
            className="message-model-selector"
            disabled={isLoading}
            bordered={false}
            dropdownMatchSelectWidth={false}
          >
            {llmConfigs.map((config) => (
              <Option key={config.id} value={config.id}>
                {config.name}
              </Option>
            ))}
          </Select>
        )}
        {hasChildBranches && (
          <BranchNavigator
            currentIndex={branchIndex}
            totalBranches={branchCount}
            onPrevious={onBranchPrevious}
            onNext={onBranchNext}
            className="message-branch-nav"
          />
        )}
        <Button
          type="text"
          size="small"
          icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
          onClick={onToggleCollapse}
          title={isCollapsed ? '展开消息' : '折叠消息'}
          className="message-collapse-btn"
        />
      </div>
      <div className="message-time">
        <RelativeTime timestamp={timestamp} />
      </div>
    </div>
  )
}

import React from 'react'
import { ChatMessage, LLMConfig } from '../../../types/type'
import { formatExactDateTime } from '../../../utils/timeFormatter'
import { Markdown } from '../../common/markdown/Markdown'

interface SingleMessageExportContainerProps {
  message: ChatMessage
  llmConfig?: LLMConfig
  width: number
  containerRef: React.RefObject<HTMLDivElement>
}

export default function SingleMessageExportContainer({
  message,
  llmConfig,
  width,
  containerRef
}: SingleMessageExportContainerProps) {
  const role = message.role === 'user' ? '用户' : 'AI助手'
  const modelName = llmConfig?.name || message.modelId

  // 根据宽度调整样式
  const getStyles = () => {
    if (width <= 375) {
      return {
        roleSize: '13px',
        metaSize: '11px',
        contentSize: '13px',
        padding: '10px',
        borderRadius: '4px'
      }
    } else if (width <= 600) {
      return {
        roleSize: '14px',
        metaSize: '12px',
        contentSize: '14px',
        padding: '12px',
        borderRadius: '6px'
      }
    } else {
      return {
        roleSize: '15px',
        metaSize: '13px',
        contentSize: '14px',
        padding: '12px',
        borderRadius: '6px'
      }
    }
  }

  const styles = getStyles()

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: `${width}px`,
        backgroundColor: '#ffffff',
        padding: width <= 375 ? '16px' : '20px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* 消息头部 */}
      <div
        style={{
          fontWeight: 'bold',
          fontSize: styles.roleSize,
          marginBottom: '8px',
          color: message.role === 'user' ? '#1890ff' : '#52c41a',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap'
        }}
      >
        <span>{role}</span>
        {modelName && message.role === 'assistant' && (
          <span style={{ fontSize: styles.metaSize, color: '#666', fontWeight: 'normal' }}>
            ({modelName})
          </span>
        )}
      </div>

      {/* 时间戳 */}
      <div style={{ fontSize: styles.metaSize, color: '#999', marginBottom: '10px' }}>
        {formatExactDateTime(message.timestamp)}
      </div>

      {/* 思考过程 */}
      {message.reasoning_content && (
        <div
          style={{
            backgroundColor: '#fafafa',
            padding: styles.padding,
            marginBottom: '12px',
            borderRadius: styles.borderRadius,
            border: '1px solid #f0f0f0'
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              marginBottom: '6px',
              fontSize: styles.metaSize,
              color: '#666'
            }}
          >
            💡 思考过程:
          </div>
          <div
            style={{
              fontSize: styles.contentSize,
              lineHeight: '1.6',
              color: '#333'
            }}
          >
            <Markdown content={message.reasoning_content} fontSize={parseInt(styles.contentSize)} />
          </div>
        </div>
      )}

      {/* 消息内容 */}
      <div
        style={{
          fontSize: styles.contentSize,
          lineHeight: '1.6',
          padding: styles.padding,
          backgroundColor: message.role === 'user' ? '#e6f7ff' : '#ffffff',
          borderRadius: styles.borderRadius,
          border: `1px solid ${message.role === 'user' ? '#91d5ff' : '#d9d9d9'}`,
          color: '#000'
        }}
      >
        <Markdown content={message.content} fontSize={parseInt(styles.contentSize)} />
      </div>
    </div>
  )
}
import React from 'react'
import { Dropdown } from 'antd'
import { Streamdown } from 'streamdown'
import type { MessageViewModeProps } from './types'
import { getStandardDropdownProps } from '../../../../utils/shortcutPresentation'

const contextMenuProps = {
  items: [] as NonNullable<MessageViewModeProps['contextMenuItems']>
}

export const MessageViewMode = React.memo(function MessageViewMode({
  displayContent,
  isAssistant,
  isStreaming,
  collapsed,
  collapsedPreview,
  contextMenuItems,
  onContextMenu,
  onExpandCollapsed
}: MessageViewModeProps): React.JSX.Element {
  const dropdownProps = getStandardDropdownProps({
    ...contextMenuProps,
    items: contextMenuItems
  })

  if (collapsed) {
    return (
      <Dropdown {...dropdownProps} trigger={['contextMenu']}>
        <div
          className="message-item__preview"
          onClick={onExpandCollapsed}
          onContextMenu={onContextMenu}
        >
          {collapsedPreview}
        </div>
      </Dropdown>
    )
  }

  return (
    <Dropdown {...dropdownProps} trigger={['contextMenu']}>
      <div className="message-item__body" onContextMenu={onContextMenu}>
        <Streamdown
          isAnimating={isStreaming && isAssistant}
          mode={isStreaming ? 'streaming' : 'static'}
        >
          {displayContent}
        </Streamdown>
      </div>
    </Dropdown>
  )
})

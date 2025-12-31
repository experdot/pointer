import React from 'react'
import type { ChatPage } from '../../../types/type'

interface HeaderProps {
  page: ChatPage
}

export function Header({ page }: HeaderProps): React.JSX.Element {
  return (
    <div className="chat-editor__header">
      <span className="chat-editor__title">{page.title}</span>
    </div>
  )
}

import React from 'react'
import { Dropdown, Button, Space } from 'antd'
import { CompressOutlined, MoreOutlined } from '@ant-design/icons'
import type { ChatPage } from '../../../types/type'

interface HeaderProps {
  page: ChatPage
  onCollapseAll?: () => void
  onExpandAll?: () => void
}

export function Header({ page, onCollapseAll, onExpandAll }: HeaderProps): React.JSX.Element {
  return (
    <div className="chat-editor__header">
      <span className="chat-editor__title">{page.title}</span>
      <Space.Compact size="small">
        <Button type="text" icon={<CompressOutlined />} onClick={onCollapseAll}>
          全部折叠
        </Button>
        <Dropdown
          menu={{
            items: [{ key: 'expand', label: '全部展开', onClick: onExpandAll }]
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      </Space.Compact>
    </div>
  )
}

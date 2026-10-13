import React from 'react'
import { Flex, Typography } from 'antd'
import { getShortcutLabel, type ShortcutLabelId } from '../../../utils/shortcutPresentation'

const { Text } = Typography

interface ShortcutItem {
  label: string
  keys: ShortcutLabelId[]
}

interface ShortcutGroup {
  title: string
  items: ShortcutItem[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: '通用',
    items: [
      { label: '新建对话', keys: ['tabNew'] },
      { label: '切换侧边栏', keys: ['toggleSidebar'] },
      { label: '全局搜索', keys: ['globalSearch'] }
    ]
  },
  {
    title: '标签页与会话历史',
    items: [
      { label: '关闭标签页', keys: ['tabClose'] },
      { label: '下一个标签页', keys: ['tabNext', 'editorNext'] },
      { label: '上一个标签页', keys: ['tabPrev', 'editorPrev'] },
      { label: '后退（历史导航）', keys: ['tabHistoryBack'] },
      { label: '前进（历史导航）', keys: ['tabHistoryForward'] }
    ]
  },
  {
    title: '聊天阅读',
    items: [
      { label: '查找', keys: ['chatFind'] },
      { label: '上一条消息', keys: ['messagePrev'] },
      { label: '下一条消息', keys: ['messageNext'] },
      { label: '第一条消息', keys: ['messageFirst'] },
      { label: '最后一条消息', keys: ['messageLast'] },
      { label: '复制消息', keys: ['messageCopy'] }
    ]
  },
  {
    title: '查找工具栏',
    items: [
      { label: '区分大小写', keys: ['findMatchCase'] },
      { label: '使用正则表达式', keys: ['findRegex'] },
      { label: '全词匹配', keys: ['findWholeWord'] }
    ]
  },
  {
    title: '资源管理器',
    items: [
      { label: '重命名', keys: ['treeRename'] },
      { label: '删除', keys: ['treeDelete'] }
    ]
  }
]

export function ShortcutsPanel(): React.JSX.Element {
  return (
    <Flex vertical gap={24} className="settings-shortcuts-panel">
      <div>
        <Text strong style={{ fontSize: 16 }}>
          快捷键
        </Text>
        <br />
        <Text type="secondary">当前平台的默认快捷键（仅展示，不支持修改）</Text>
      </div>

      {shortcutGroups.map((group) => (
        <div key={group.title} className="settings-shortcuts-group">
          <Text strong>{group.title}</Text>
          <div className="settings-shortcuts-list">
            {group.items.map((item) => (
              <div key={item.label} className="settings-shortcuts-row">
                <span>{item.label}</span>
                <span className="settings-shortcuts-keys">
                  {item.keys.map((key) => (
                    <kbd key={key} className="settings-shortcuts-key">
                      {getShortcutLabel(key)}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Flex>
  )
}

import { t, useI18n } from '@renderer/i18n'
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
    get title(): string {
      return t('settings.general')
    },
    items: [
      {
        get label(): string {
          return t('chat.newConversation')
        },
        keys: ['tabNew']
      },
      {
        get label(): string {
          return t('layout.toggleSidebar')
        },
        keys: ['toggleSidebar']
      },
      {
        get label(): string {
          return t('search.global')
        },
        keys: ['globalSearch']
      }
    ]
  },
  {
    get title(): string {
      return t('shortcuts.tabsHistory')
    },
    items: [
      {
        get label(): string {
          return t('tabs.close')
        },
        keys: ['tabClose']
      },
      {
        get label(): string {
          return t('tabs.next')
        },
        keys: ['tabNext', 'editorNext']
      },
      {
        get label(): string {
          return t('tabs.previous')
        },
        keys: ['tabPrev', 'editorPrev']
      },
      {
        get label(): string {
          return t('shortcuts.historyBack')
        },
        keys: ['tabHistoryBack']
      },
      {
        get label(): string {
          return t('shortcuts.historyForward')
        },
        keys: ['tabHistoryForward']
      }
    ]
  },
  {
    get title(): string {
      return t('shortcuts.reading')
    },
    items: [
      {
        get label(): string {
          return t('search.find')
        },
        keys: ['chatFind']
      },
      {
        get label(): string {
          return t('chat.previousMessage')
        },
        keys: ['messagePrev']
      },
      {
        get label(): string {
          return t('chat.nextMessage')
        },
        keys: ['messageNext']
      },
      {
        get label(): string {
          return t('chat.firstMessage')
        },
        keys: ['messageFirst']
      },
      {
        get label(): string {
          return t('chat.lastMessage')
        },
        keys: ['messageLast']
      },
      {
        get label(): string {
          return t('chat.copyMessage')
        },
        keys: ['messageCopy']
      }
    ]
  },
  {
    get title(): string {
      return t('shortcuts.findToolbar')
    },
    items: [
      {
        get label(): string {
          return t('search.matchCase')
        },
        keys: ['findMatchCase']
      },
      {
        get label(): string {
          return t('search.regex')
        },
        keys: ['findRegex']
      },
      {
        get label(): string {
          return t('search.wholeWord')
        },
        keys: ['findWholeWord']
      }
    ]
  },
  {
    get title(): string {
      return t('layout.explorer')
    },
    items: [
      {
        get label(): string {
          return t('common.rename')
        },
        keys: ['treeRename']
      },
      {
        get label(): string {
          return t('common.delete')
        },
        keys: ['treeDelete']
      }
    ]
  }
]

export function ShortcutsPanel(): React.JSX.Element {
  useI18n()

  return (
    <Flex vertical gap={24} className="settings-shortcuts-panel">
      <div>
        <Text strong style={{ fontSize: 16 }}>
          {t('settings.shortcuts')}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('shortcuts.defaults')}
        </Text>
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

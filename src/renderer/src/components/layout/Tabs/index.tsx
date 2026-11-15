import { t, useI18n } from '@renderer/i18n'
import React from 'react'
import { Tabs as AntTabs, Dropdown, Button, Tooltip } from 'antd'
import type { TabsProps, MenuProps } from 'antd'
import {
  PushpinFilled,
  LeftOutlined,
  RightOutlined,
  DeleteOutlined,
  PlusOutlined,
  CloseOutlined
} from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTabsStore } from '../../../stores/tabsStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useLayoutStore } from '../../../stores/layoutStore'
import * as pagesService from '../../../services/pagesService'
import { getTabIcon } from '../../../utils/tabRegistry'
import {
  formatShortcutTooltip,
  getStandardDropdownProps,
  getShortcutLabel
} from '../../../utils/shortcutPresentation'
import './Tabs.css'
import type { Tab } from '@shared/contracts'

function displayTabTitle(tab: Tab): string {
  if (tab.type === 'welcome') return t('welcome.tab')
  if (tab.type === 'settings') return t('settings.title')
  if (tab.type === 'export') return t('common.export')
  return tab.title
}

interface DraggableTabProps {
  id: string
  children: React.ReactNode
}

function DraggableTab({ id, children }: DraggableTabProps): React.JSX.Element {
  useI18n()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'move'
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

export function Tabs(): React.JSX.Element {
  useI18n()

  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    reorderTabs,
    togglePinTab,
    closeOtherTabs,
    closeRightTabs,
    closeAllTabs,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    keepTab,
    history,
    historyIndex,
    clearHistory,
    navigateToHistoryIndex
  } = useTabsStore()
  const { revealPanel } = useLayoutStore()
  // 直接使用 pagesService，避免订阅 pagesStore 导致不必要的重渲染
  const { createPage, openPage } = pagesService

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  )

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tabs.findIndex((t) => t.id === active.id)
    const newIndex = tabs.findIndex((t) => t.id === over.id)
    reorderTabs(oldIndex, newIndex)
  }

  const getContextMenuItems = (tabId: string): MenuProps['items'] => {
    const tab = tabs.find((t) => t.id === tabId)
    const items: MenuProps['items'] = []

    if (tab?.preview) {
      items.push({
        key: 'keep',
        label: t('tabs.keepOpen'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          keepTab(tabId)
        }
      })
      items.push({ type: 'divider' })
    }

    items.push(
      {
        key: 'close',
        label: t('common.close'),
        extra: getShortcutLabel('tabClose'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeTab(tabId)
        }
      },
      {
        key: 'closeOthers',
        label: t('tabs.closeOthers'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeOtherTabs(tabId)
        }
      },
      {
        key: 'closeRight',
        label: t('tabs.closeRight'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeRightTabs(tabId)
        }
      },
      {
        key: 'closeAll',
        label: t('tabs.closeAll'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeAllTabs()
        }
      },
      { type: 'divider' },
      {
        key: 'pin',
        label: tab?.pinned ? t('tabs.unpin') : t('tabs.pin'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          togglePinTab(tabId)
        }
      }
    )

    // 只有当前激活的 tab 才显示"在资源管理器中显示"
    if (tab?.dataId && tabId === activeTabId) {
      items.push(
        { type: 'divider' },
        {
          key: 'revealInExplorer',
          label: t('tabs.reveal'),
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            revealPanel('explorer')
          }
        }
      )
    }

    return items
  }

  const items: TabsProps['items'] = tabs.map((tab) => ({
    key: tab.id,
    label: (
      <Dropdown
        {...getStandardDropdownProps({ items: getContextMenuItems(tab.id) })}
        trigger={['contextMenu']}
      >
        <span
          className={`tab-label ${tab.preview ? 'tab-preview' : ''}`}
          onDoubleClick={() => tab.preview && keepTab(tab.id)}
        >
          {tab.pinned && <PushpinFilled className="tab-pin-icon" />}
          <span className="tab-icon">{getTabIcon(tab.type)}</span>
          <span className="tab-title">{displayTabTitle(tab)}</span>
        </span>
      </Dropdown>
    ),
    closable: tab.closable !== false
  }))

  const handleEdit: TabsProps['onEdit'] = async (targetKey, action) => {
    if (action === 'add') {
      const page = await createPage()
      openPage(page.id)
    } else if (action === 'remove' && typeof targetKey === 'string') {
      closeTab(targetKey)
    }
  }

  const renderTabBar: TabsProps['renderTabBar'] = (tabBarProps, DefaultTabBar) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
        <DefaultTabBar {...tabBarProps}>
          {(node) => (
            <DraggableTab key={node.key} id={node.key as string}>
              {node}
            </DraggableTab>
          )}
        </DefaultTabBar>
      </SortableContext>
    </DndContext>
  )

  // 历史记录右键菜单
  const getHistoryMenuItems = (): MenuProps['items'] => {
    const pages = usePagesStore.getState().pages

    // 获取历史条目的标题：优先从打开的 tab 获取，其次从 pages 获取
    const getEntryTitle = (entry: (typeof history)[number]): string => {
      const tab = tabs.find((t) => t.id === entry.tabId)
      if (tab?.title) return displayTabTitle(tab)
      if (['welcome', 'settings', 'export'].includes(entry.type))
        return displayTabTitle({ id: entry.tabId, type: entry.type, title: '' })
      if (entry.dataId) {
        const page = pages.find((p) => p.id === entry.dataId)
        if (page?.name) return page.name
      }
      return t('tabs.unknownPage')
    }

    const historyItems: MenuProps['items'] = history
      .map((entry, index) => ({ entry, index }))
      .toReversed()
      .map(({ entry, index }) => {
        const isCurrent = index === historyIndex
        return {
          key: `history-${index}`,
          label: (
            <span style={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
              {isCurrent ? '→ ' : ''}
              {getEntryTitle(entry)}
            </span>
          ),
          onClick: () => navigateToHistoryIndex(index)
        }
      })

    return [
      {
        key: 'clear',
        label: t('tabs.clearHistory'),
        icon: <DeleteOutlined />,
        danger: true,
        onClick: clearHistory
      },
      { type: 'divider' },
      ...historyItems
    ]
  }

  if (tabs.length === 0) return <></>

  return (
    <div className="tabs-wrapper">
      <Dropdown
        {...getStandardDropdownProps({
          items: getHistoryMenuItems(),
          style: { maxHeight: 400, overflow: 'auto' }
        })}
        trigger={['contextMenu']}
      >
        <div className="tabs-nav-buttons">
          <Tooltip title={formatShortcutTooltip(t('tabs.back'), 'tabHistoryBack')}>
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              disabled={!canGoBack()}
              onClick={goBack}
            />
          </Tooltip>
          <Tooltip title={formatShortcutTooltip(t('tabs.forward'), 'tabHistoryForward')}>
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              disabled={!canGoForward()}
              onClick={goForward}
            />
          </Tooltip>
        </div>
      </Dropdown>
      <AntTabs
        className="tabs-container"
        type="editable-card"
        items={items}
        activeKey={activeTabId || undefined}
        onChange={setActiveTab}
        onEdit={handleEdit}
        addIcon={
          <Tooltip title={formatShortcutTooltip(t('common.new'), 'tabNew')}>
            <span>
              <PlusOutlined />
            </span>
          </Tooltip>
        }
        removeIcon={
          <Tooltip title={formatShortcutTooltip(t('common.close'), 'tabClose')}>
            <span>
              <CloseOutlined />
            </span>
          </Tooltip>
        }
        renderTabBar={renderTabBar}
      />
    </div>
  )
}

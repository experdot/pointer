import React from 'react'
import { Tabs as AntTabs, Dropdown, Button } from 'antd'
import type { TabsProps, MenuProps } from 'antd'
import {
  PushpinFilled,
  LeftOutlined,
  RightOutlined,
  DeleteOutlined
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
import './Tabs.css'

interface DraggableTabProps {
  id: string
  children: React.ReactNode
}

function DraggableTab({ id, children }: DraggableTabProps): React.JSX.Element {
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
        label: '保持打开',
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
        label: '关闭',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeTab(tabId)
        }
      },
      {
        key: 'closeOthers',
        label: '关闭其他',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeOtherTabs(tabId)
        }
      },
      {
        key: 'closeRight',
        label: '关闭右侧',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeRightTabs(tabId)
        }
      },
      {
        key: 'closeAll',
        label: '关闭全部',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation()
          closeAllTabs()
        }
      },
      { type: 'divider' },
      {
        key: 'pin',
        label: tab?.pinned ? '取消固定' : '固定',
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
          label: '在资源管理器中显示',
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
      <Dropdown menu={{ items: getContextMenuItems(tab.id) }} trigger={['contextMenu']}>
        <span
          className={`tab-label ${tab.preview ? 'tab-preview' : ''}`}
          onDoubleClick={() => tab.preview && keepTab(tab.id)}
        >
          {tab.pinned && <PushpinFilled className="tab-pin-icon" />}
          <span className="tab-icon">{getTabIcon(tab.type)}</span>
          <span className="tab-title">{tab.title}</span>
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
      if (tab?.title) return tab.title
      if (entry.dataId) {
        const page = pages.find((p) => p.id === entry.dataId)
        if (page?.name) return page.name
      }
      return '未知页面'
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
        label: '清空导航历史',
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
        menu={{ items: getHistoryMenuItems(), style: { maxHeight: 400, overflow: 'auto' } }}
        trigger={['contextMenu']}
      >
        <div className="tabs-nav-buttons">
          <Button
            type="text"
            size="small"
            icon={<LeftOutlined />}
            disabled={!canGoBack()}
            onClick={goBack}
          />
          <Button
            type="text"
            size="small"
            icon={<RightOutlined />}
            disabled={!canGoForward()}
            onClick={goForward}
          />
        </div>
      </Dropdown>
      <AntTabs
        className="tabs-container"
        type="editable-card"
        items={items}
        activeKey={activeTabId || undefined}
        onChange={setActiveTab}
        onEdit={handleEdit}
        renderTabBar={renderTabBar}
      />
    </div>
  )
}

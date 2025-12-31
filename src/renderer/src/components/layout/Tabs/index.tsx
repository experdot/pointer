import React from 'react'
import { Tabs as AntTabs, Dropdown, Button } from 'antd'
import type { TabsProps, MenuProps } from 'antd'
import { PushpinFilled, LeftOutlined, RightOutlined, DeleteOutlined } from '@ant-design/icons'
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
import { usePages } from '../../../hooks/usePages'
import { getTabIcon, validateTabData } from '../../../utils/tabRegistry'
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
  const { createPage, openPage } = usePages()

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
    return [
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
    ]
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

  const handleEdit: TabsProps['onEdit'] = (targetKey, action) => {
    if (action === 'add') {
      const page = createPage()
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
    const historyItems: MenuProps['items'] = history
      .map((tabId, index) => ({ tabId, index }))
      .filter(({ tabId }) => validateTabData(tabId))
      .map(({ tabId, index }) => {
        const tab = tabs.find((t) => t.id === tabId)
        const isCurrent = index === historyIndex
        return {
          key: `history-${index}`,
          label: (
            <span style={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
              {isCurrent ? '→ ' : ''}
              {tab?.title || tabId}
            </span>
          ),
          onClick: () => navigateToHistoryIndex(index)
        }
      })

    return [
      ...historyItems,
      { type: 'divider' },
      {
        key: 'clear',
        label: '清空历史',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: clearHistory
      }
    ]
  }

  if (tabs.length === 0) return <></>

  return (
    <div className="tabs-wrapper">
      <Dropdown menu={{ items: getHistoryMenuItems() }} trigger={['contextMenu']}>
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

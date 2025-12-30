import React from 'react'
import { Tabs as AntTabs, Dropdown } from 'antd'
import type { TabsProps, MenuProps } from 'antd'
import { MessageOutlined, SettingOutlined, HomeOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTabsStore, type TabType } from '../../../stores/tabsStore'
import { usePages } from '../../../hooks/usePages'
import './Tabs.css'

const tabIcons: Record<TabType, React.ReactNode> = {
  welcome: <HomeOutlined />,
  chat: <MessageOutlined />,
  settings: <SettingOutlined />
}

interface DraggableTabProps {
  id: string
  children: React.ReactNode
}

function DraggableTab({ id, children }: DraggableTabProps) {
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
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs, closeOtherTabs, closeRightTabs, closeAllTabs } =
    useTabsStore()
  const { createPage, openPage } = usePages()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tabs.findIndex((t) => t.id === active.id)
    const newIndex = tabs.findIndex((t) => t.id === over.id)
    reorderTabs(oldIndex, newIndex)
  }

  const getContextMenuItems = (tabId: string): MenuProps['items'] => [
    { key: 'close', label: '关闭', onClick: () => closeTab(tabId) },
    { key: 'closeOthers', label: '关闭其他', onClick: () => closeOtherTabs(tabId) },
    { key: 'closeRight', label: '关闭右侧', onClick: () => closeRightTabs(tabId) },
    { key: 'closeAll', label: '关闭全部', onClick: () => closeAllTabs() }
  ]

  const items: TabsProps['items'] = tabs.map((tab) => ({
    key: tab.id,
    label: (
      <Dropdown menu={{ items: getContextMenuItems(tab.id) }} trigger={['contextMenu']}>
        <span className="tab-label">
          <span className="tab-icon">{tabIcons[tab.type]}</span>
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

  if (tabs.length === 0) return <></>

  return (
    <AntTabs
      className="tabs-container"
      type="editable-card"
      items={items}
      activeKey={activeTabId || undefined}
      onChange={setActiveTab}
      onEdit={handleEdit}
      renderTabBar={renderTabBar}
    />
  )
}

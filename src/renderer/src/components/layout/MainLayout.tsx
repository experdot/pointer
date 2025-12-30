import React from 'react'
import { Flex } from 'antd'
import { TitleBar } from './TitleBar'
import { ActivityBar } from './ActivityBar'
import { Sidebar } from './Sidebar'
import { EditorArea } from './EditorArea'
import './MainLayout.css'

export function MainLayout(): React.JSX.Element {
  return (
    <Flex className="main-layout" vertical>
      <TitleBar />
      <Flex className="main-layout-body" flex={1}>
        <ActivityBar />
        <Sidebar />
        <EditorArea />
      </Flex>
    </Flex>
  )
}

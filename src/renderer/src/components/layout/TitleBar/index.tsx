import React from 'react'
import { Flex, Typography } from 'antd'
import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons'
import './TitleBar.css'

const { Text } = Typography

export function TitleBar(): React.JSX.Element {
  const handleMinimize = () => window.electron?.ipcRenderer.invoke('window-minimize')
  const handleMaximize = () => window.electron?.ipcRenderer.invoke('window-maximize')
  const handleClose = () => window.electron?.ipcRenderer.invoke('window-close')

  return (
    <Flex className="title-bar" align="center" justify="space-between">
      <Flex className="title-bar-drag" align="center" flex={1}>
        <Text className="title-bar-title">Pointer</Text>
      </Flex>
      <Flex className="title-bar-controls">
        <button className="title-bar-btn" onClick={handleMinimize}>
          <MinusOutlined />
        </button>
        <button className="title-bar-btn" onClick={handleMaximize}>
          <BorderOutlined />
        </button>
        <button className="title-bar-btn title-bar-btn-close" onClick={handleClose}>
          <CloseOutlined />
        </button>
      </Flex>
    </Flex>
  )
}

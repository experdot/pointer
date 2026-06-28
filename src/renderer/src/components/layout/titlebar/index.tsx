import React, { useEffect, useState } from 'react'
import { Flex, Typography } from 'antd'
import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons'
import './TitleBar.css'

const { Text } = Typography

export function TitleBar(): React.JSX.Element {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    window.electronWindow?.getPlatform().then((platform: string) => {
      setIsMac(platform === 'darwin')
    })
  }, [])

  const handleMinimize = (): void => {
    window.electron?.ipcRenderer.invoke('window-minimize')
  }
  const handleMaximize = (): void => {
    window.electron?.ipcRenderer.invoke('window-maximize')
  }
  const handleClose = (): void => {
    window.electron?.ipcRenderer.invoke('window-close')
  }

  return (
    <Flex
      className={`title-bar ${isMac ? 'title-bar-mac' : ''}`}
      align="center"
      justify="space-between"
    >
      <Flex className="title-bar-drag" align="center" flex={1}>
        {!isMac && <Text className="title-bar-title">Pointer</Text>}
      </Flex>
      {!isMac && (
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
      )}
    </Flex>
  )
}

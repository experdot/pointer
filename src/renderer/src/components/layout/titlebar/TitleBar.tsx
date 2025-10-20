import React, { useState, useEffect } from 'react'
import { Button, Tooltip } from 'antd'
import {
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  CopyOutlined,
  SendOutlined
} from '@ant-design/icons'
import './titlebar.css'

interface TitleBarProps {
  title: string
}

export default function TitleBar({ title }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const platform = await (window as any).electronWindow.getPlatform()
        setIsMac(platform === 'darwin')

        const maximized = await (window as any).electronWindow.isMaximized()
        setIsMaximized(maximized)
      } catch (error) {
        console.error('Error initializing titlebar:', error)
      }
    }
    init()
  }, [])

  const handleMinimize = async () => {
    try {
      await (window as any).electronWindow.minimize()
    } catch (error) {
      console.error('Error minimizing window:', error)
    }
  }

  const handleMaximize = async () => {
    try {
      await (window as any).electronWindow.maximize()
      const maximized = await (window as any).electronWindow.isMaximized()
      setIsMaximized(maximized)
    } catch (error) {
      console.error('Error maximizing window:', error)
    }
  }

  const handleClose = async () => {
    try {
      await (window as any).electronWindow.close()
    } catch (error) {
      console.error('Error closing window:', error)
    }
  }

  return (
    <div className={`custom-title-bar ${isMac ? 'mac' : ''}`}>
      <div className="title-bar-drag-region">
        <div className="title-bar-left">
          <SendOutlined className="title-bar-logo" />
          <h2 className="title-bar-title">{title}</h2>
        </div>
        {!isMac && (
          <div className="title-bar-right">
            <Tooltip title="最小化">
              <Button
                type="text"
                icon={<MinusOutlined />}
                onClick={handleMinimize}
                className="title-bar-control-button"
              />
            </Tooltip>
            <Tooltip title={isMaximized ? '还原' : '最大化'}>
              <Button
                type="text"
                icon={isMaximized ? <CopyOutlined /> : <BorderOutlined />}
                onClick={handleMaximize}
                className="title-bar-control-button"
              />
            </Tooltip>
            <Tooltip title="关闭">
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={handleClose}
                className="title-bar-control-button title-bar-close-button"
              />
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}

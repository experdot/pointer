import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Modal, Button } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  FullscreenOutlined,
  CloseOutlined
} from '@ant-design/icons'
import './ImagePreviewModal.css'

interface ImagePreviewModalProps {
  visible: boolean
  src: string
  name?: string
  onClose: () => void
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  src,
  name,
  onClose
}) => {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const positionStart = useRef({ x: 0, y: 0 })

  // 重置状态
  useEffect(() => {
    if (visible) {
      setScale(1)
      setRotation(0)
      setPosition({ x: 0, y: 0 })
    }
  }, [visible, src])

  // 缩放
  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.25, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.25, 0.2))
  }, [])

  // 旋转
  const handleRotateLeft = useCallback(() => {
    setRotation((r) => r - 90)
  }, [])

  const handleRotateRight = useCallback(() => {
    setRotation((r) => r + 90)
  }, [])

  // 重置
  const handleReset = useCallback(() => {
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }, [])

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => Math.max(0.2, Math.min(5, s * delta)))
  }, [])

  // 拖拽
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale > 1) {
        setIsDragging(true)
        dragStart.current = { x: e.clientX, y: e.clientY }
        positionStart.current = { ...position }
      }
    },
    [scale, position]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x
        const dy = e.clientY - dragStart.current.y
        setPosition({
          x: positionStart.current.x + dx,
          y: positionStart.current.y + dy
        })
      }
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 键盘快捷键
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          handleZoomIn()
          break
        case '-':
          handleZoomOut()
          break
        case 'ArrowLeft':
          handleRotateLeft()
          break
        case 'ArrowRight':
          handleRotateRight()
          break
        case '0':
          handleReset()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose, handleZoomIn, handleZoomOut, handleRotateLeft, handleRotateRight, handleReset])

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width="90vw"
      centered
      destroyOnClose
      className="image-preview-modal"
      closeIcon={<CloseOutlined />}
      title={name}
    >
      <div className="image-preview-modal__toolbar">
        <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} title="缩小 (-)" />
        <span className="image-preview-modal__scale">{Math.round(scale * 100)}%</span>
        <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} title="放大 (+)" />
        <div className="image-preview-modal__divider" />
        <Button icon={<RotateLeftOutlined />} onClick={handleRotateLeft} title="向左旋转 (←)" />
        <Button icon={<RotateRightOutlined />} onClick={handleRotateRight} title="向右旋转 (→)" />
        <div className="image-preview-modal__divider" />
        <Button icon={<FullscreenOutlined />} onClick={handleReset} title="重置 (0)" />
      </div>

      <div
        className="image-preview-modal__container"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={name}
          className="image-preview-modal__image"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
          draggable={false}
        />
      </div>
    </Modal>
  )
}

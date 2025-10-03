import { useState, useCallback } from 'react'

interface DrawHistory {
  imageData: ImageData
}

export function useCanvasHistory(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [history, setHistory] = useState<DrawHistory[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const newHistory = history.slice(0, currentHistoryIndex + 1)
    newHistory.push({ imageData })
    setHistory(newHistory)
    setCurrentHistoryIndex(newHistory.length - 1)
  }, [canvasRef, history, currentHistoryIndex])

  const undo = useCallback(() => {
    if (currentHistoryIndex <= 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newIndex = currentHistoryIndex - 1
    ctx.putImageData(history[newIndex].imageData, 0, 0)
    setCurrentHistoryIndex(newIndex)
  }, [canvasRef, history, currentHistoryIndex])

  const redo = useCallback(() => {
    if (currentHistoryIndex >= history.length - 1) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newIndex = currentHistoryIndex + 1
    ctx.putImageData(history[newIndex].imageData, 0, 0)
    setCurrentHistoryIndex(newIndex)
  }, [canvasRef, history, currentHistoryIndex])

  const canUndo = currentHistoryIndex > 0
  const canRedo = currentHistoryIndex < history.length - 1

  return {
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    historyLength: history.length
  }
}

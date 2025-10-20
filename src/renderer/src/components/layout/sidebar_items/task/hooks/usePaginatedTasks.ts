import { useState, useEffect, useMemo } from 'react'
import { AITask } from '../../../../../types/type'

const PAGE_SIZE = 10

interface PaginationState {
  running: number
  completed: number
  failed: number
}

export function usePaginatedTasks(
  runningTasks: AITask[],
  completedTasks: AITask[],
  failedTasks: AITask[]
) {
  const [pages, setPages] = useState<PaginationState>({
    running: 1,
    completed: 1,
    failed: 1
  })

  // 自动重置分页当列表长度变化时
  useEffect(() => {
    setPages((prev) => ({
      ...prev,
      running: prev.running > Math.ceil(runningTasks.length / PAGE_SIZE) ? 1 : prev.running
    }))
  }, [runningTasks.length])

  useEffect(() => {
    setPages((prev) => ({
      ...prev,
      completed: prev.completed > Math.ceil(completedTasks.length / PAGE_SIZE) ? 1 : prev.completed
    }))
  }, [completedTasks.length])

  useEffect(() => {
    setPages((prev) => ({
      ...prev,
      failed: prev.failed > Math.ceil(failedTasks.length / PAGE_SIZE) ? 1 : prev.failed
    }))
  }, [failedTasks.length])

  const paginatedRunning = useMemo(
    () => runningTasks.slice((pages.running - 1) * PAGE_SIZE, pages.running * PAGE_SIZE),
    [runningTasks, pages.running]
  )

  const paginatedCompleted = useMemo(
    () => completedTasks.slice((pages.completed - 1) * PAGE_SIZE, pages.completed * PAGE_SIZE),
    [completedTasks, pages.completed]
  )

  const paginatedFailed = useMemo(
    () => failedTasks.slice((pages.failed - 1) * PAGE_SIZE, pages.failed * PAGE_SIZE),
    [failedTasks, pages.failed]
  )

  const setRunningPage = (page: number) => {
    setPages((prev) => ({ ...prev, running: page }))
  }

  const setCompletedPage = (page: number) => {
    setPages((prev) => ({ ...prev, completed: page }))
  }

  const setFailedPage = (page: number) => {
    setPages((prev) => ({ ...prev, failed: page }))
  }

  return {
    pages,
    paginatedRunning,
    paginatedCompleted,
    paginatedFailed,
    setRunningPage,
    setCompletedPage,
    setFailedPage,
    PAGE_SIZE
  }
}

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeError } from '@shared/contracts'
import { usePages } from './usePages'
import { command } from '../runtime/client'
import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore } from '../stores/foldersStore'

vi.mock('../runtime/client', () => ({ command: vi.fn(), query: vi.fn() }))

beforeEach(() => {
  vi.mocked(command).mockReset().mockResolvedValue(undefined)
  usePagesStore.getState().reset()
  useFoldersStore.getState().reset()
})

describe('资源管理器移动命令', () => {
  it.each(['before', 'after', 'inside'] as const)('%s 只发送一条移动意图', async (placement) => {
    const { result } = renderHook(usePages)
    const move = { nodeId: 'source', targetNodeId: 'target', placement }
    await result.current.moveNode(move)
    expect(command).toHaveBeenCalledExactlyOnceWith('tree.move', move)
  })

  it('失败由调用方处理，不自动重试或修改镜像；明确重命名时只发一条新命令', async () => {
    const pages = [{ id: 'source', name: '原名', kind: 'page' as const, order: 0, createdAt: 1 }]
    usePagesStore.setState({ pages })
    const { result } = renderHook(usePages)
    const move = { nodeId: 'source', targetNodeId: 'target', placement: 'inside' as const }
    const error = new RuntimeError('tree.name-conflict', '重名')
    vi.mocked(command).mockRejectedValueOnce(error)
    await expect(result.current.moveNode(move)).rejects.toBe(error)
    expect(command).toHaveBeenCalledTimes(1)
    expect(usePagesStore.getState().pages).toBe(pages)

    vi.mocked(command).mockClear()
    await result.current.moveNode({ ...move, conflictPolicy: 'rename' })
    expect(command).toHaveBeenCalledExactlyOnceWith('tree.move', {
      ...move,
      conflictPolicy: 'rename'
    })
  })
})

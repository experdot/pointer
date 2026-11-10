import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSavedAction } from './useSavedAction'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), error: vi.fn(), command: vi.fn() }))
vi.mock('antd', () => ({
  App: { useApp: () => ({ modal: { confirm: mocks.confirm }, message: { error: mocks.error } }) }
}))
vi.mock('../runtime/client', () => ({ command: mocks.command, errorMessage: String }))

beforeEach(() => vi.resetAllMocks())
const unsaved = Object.assign(new Error('unsaved'), { code: 'chat.unsaved', details: ['request'] })

function savedAction(): ReturnType<typeof useSavedAction> {
  let action!: ReturnType<typeof useSavedAction>
  function Probe(): null {
    action = useSavedAction()
    return null
  }
  renderToString(createElement(Probe))
  return action
}

describe('[R8] 切换时重试保存或取消', () => {
  it('取消保留当前工作区，不重试写入或切换', async () => {
    const action = vi.fn().mockRejectedValue(unsaved)
    mocks.confirm.mockResolvedValue(false)
    expect(await savedAction()(action)).toBe(false)
    expect(action).toHaveBeenCalledOnce()
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('先保存完整回答，再继续切换', async () => {
    let saved = false
    const action = vi.fn(async () => {
      if (!saved) throw unsaved
    })
    mocks.confirm.mockResolvedValue(true)
    mocks.command.mockImplementation(async () => {
      saved = true
    })
    expect(await savedAction()(action)).toBe(true)
    expect(action).toHaveBeenCalledTimes(2)
    expect(mocks.command).toHaveBeenCalledExactlyOnceWith('chat.retrySave', {
      requestId: 'request'
    })
  })

  it('保存再次失败仍可取消，不丢失失败原因', async () => {
    const action = vi.fn().mockRejectedValue(unsaved)
    mocks.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    mocks.command.mockRejectedValue(new Error('disk full'))
    expect(await savedAction()(action)).toBe(false)
    expect(mocks.error).toHaveBeenCalledWith('Error: disk full')
    expect(mocks.command).toHaveBeenCalledOnce()
  })
})

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@shared/domain'
import { ExportEditor } from './index'
import { MessagesSourceSelector } from './sources/MessagesSource'
import { useExportStore } from '../../../stores/exportStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { exportManager } from '../../../features/export/ExportManager'
import { registerSourcePlugins } from '../../../features/export/plugins/sources'
import { registerFormatPlugins } from '../../../features/export/plugins/formats'
import type { ExportEditorContext, MessagesSourceData } from '../../../features/export/types'
import { deferred } from '../../../../../../tests/helpers/deferred'

vi.mock('../../../runtime/client', () => ({
  query: vi.fn(),
  command: vi.fn(),
  errorMessage: (error: unknown) => String(error)
}))
vi.mock(
  '../../../features/export',
  async () => await import('../../../features/export/ExportManager')
)
vi.mock('./panels/PreviewPanel', () => ({
  PreviewPanel: function Probe() {
    const { sourceData, previewResult, isPreviewStale } = useExportStore()
    return (
      <output aria-label="导出状态">
        {JSON.stringify({ sourceData, previewResult, isPreviewStale })}
      </output>
    )
  }
}))

const record: Conversation = {
  pageId: 'p',
  leafMessageId: 'b',
  topics: [],
  messages: [
    { id: 'u', role: 'user', content: '我的问题', branchIndex: 0, createdAt: 1 },
    {
      id: 'a',
      role: 'assistant',
      content: '最初的回答',
      parentMessageId: 'u',
      branchIndex: 0,
      createdAt: 2
    },
    {
      id: 'b',
      role: 'assistant',
      content: '另一个回答',
      parentMessageId: 'u',
      branchIndex: 1,
      createdAt: 3
    }
  ]
}

function state(): {
  sourceData: MessagesSourceData
  previewResult: { content: string } | null
  isPreviewStale: boolean
} {
  return JSON.parse(screen.getByLabelText('导出状态').textContent!)
}

beforeEach(() => {
  registerSourcePlugins()
  registerFormatPlugins()
  useMessagesStore.getState().reset()
  useMessagesStore.getState().setConversation(record)
  useSettingsStore.getState().reset()
})

describe('会话导出入口初始化与分支范围', () => {
  it.each(['current-branch', 'free-select'] as const)(
    '%s 保留打开时的范围并自动预览',
    async (selectionMode) => {
      const context: ExportEditorContext = {
        sourceType: 'messages',
        pageId: 'p',
        selectionMode,
        branchMessageIds: ['u', 'a'],
        messageIds: ['u', 'a']
      }
      render(<ExportEditor context={context} />)
      await waitFor(() => expect(state().previewResult?.content).toContain('最初的回答'))
      expect(state().previewResult?.content).not.toContain('另一个回答')
      expect(state().sourceData.selectionMode).toBe(selectionMode)
      expect(state().sourceData.selectedMessageIds).toEqual(['u', 'a'])
      if (selectionMode === 'free-select') {
        expect(screen.getAllByRole('checkbox', { name: /^选择消息/ })).toHaveLength(2)
        fireEvent.click(screen.getByRole('checkbox', { name: '选择消息 我的问题' }))
        expect(state().sourceData.selectedMessageIds).toEqual(['a'])
        expect(state().isPreviewStale).toBe(true)
        fireEvent.click(screen.getByRole('button', { name: '生成预览' }))
        await waitFor(() => expect(state().isPreviewStale).toBe(false))
        expect(state().previewResult?.content).not.toContain('我的问题')
        fireEvent.click(screen.getByRole('checkbox', { name: '选择消息 最初的回答' }))
        expect(state().sourceData.selectedMessageIds).toEqual([])
        expect(
          (screen.getByRole('button', { name: '生成预览' }) as HTMLButtonElement).disabled
        ).toBe(true)
      }
    }
  )

  it('旧的仅传会话入口自动填充当前分支，旧的单消息入口保留指定消息', async () => {
    const view = render(<ExportEditor context={{ sourceType: 'messages', pageId: 'p' }} />)
    await waitFor(() => expect(state().previewResult?.content).toContain('另一个回答'))
    expect(state().sourceData.selectedMessageIds).toEqual(['u', 'b'])
    view.rerender(
      <ExportEditor context={{ sourceType: 'messages', pageId: 'p', messageIds: ['a'] }} />
    )
    await waitFor(() => expect(state().previewResult?.content).toContain('最初的回答'))
    expect(state().sourceData.selectionMode).toBe('free-select')
    expect(state().sourceData.selectedMessageIds).toEqual(['a'])
    expect(state().previewResult?.content).not.toContain('我的问题')
  })

  it('空分支不预览，后续加载失败可重试', async () => {
    const generate = vi.spyOn(exportManager, 'generatePreview')
    useMessagesStore.getState().setConversation({ pageId: 'p', messages: [], topics: [] })
    const view = render(<ExportEditor context={{ sourceType: 'messages', pageId: 'p' }} />)
    await screen.findByText('没有消息可导出')
    expect(generate).not.toHaveBeenCalled()
    view.unmount()
    useMessagesStore.getState().setConversation(record)
    vi.spyOn(useMessagesStore.getState(), 'load').mockRejectedValueOnce(new Error('读取失败'))
    render(<ExportEditor context={{ sourceType: 'messages', pageId: 'p' }} />)
    await screen.findByText('读取导出消息失败')
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
    await waitFor(() => expect(state().previewResult?.content).toContain('另一个回答'))
  })

  it('旧上下文的慢加载不能覆盖新上下文及用户勾选', async () => {
    const slow = deferred<Conversation>()
    vi.spyOn(useMessagesStore.getState(), 'load').mockReturnValueOnce(slow.promise)
    const view = render(<ExportEditor context={{ sourceType: 'messages', pageId: 'old' }} />)
    view.rerender(
      <ExportEditor
        context={{
          sourceType: 'messages',
          pageId: 'p',
          selectionMode: 'free-select',
          branchMessageIds: ['u', 'b'],
          messageIds: ['u', 'b']
        }}
      />
    )
    await screen.findByRole('checkbox', { name: '选择消息 我的问题' })
    fireEvent.click(screen.getByRole('checkbox', { name: '选择消息 我的问题' }))
    await act(async () => {
      slow.resolve({ ...record, pageId: 'old' })
    })
    expect(state().sourceData.pageId).toBe('p')
    expect(state().sourceData.selectedMessageIds).toEqual(['b'])
  })

  it('选择器慢加载不覆盖外部已经更新的选区', async () => {
    const slow = deferred<Conversation>()
    vi.spyOn(useMessagesStore.getState(), 'load').mockReturnValueOnce(slow.promise)
    const onChange = vi.fn()
    const view = render(<MessagesSourceSelector data={null} pageId="p" onChange={onChange} />)
    view.rerender(
      <MessagesSourceSelector
        data={{
          type: 'messages',
          pageId: 'p',
          selectionMode: 'free-select',
          branchMessageIds: ['u', 'b'],
          selectedMessageIds: []
        }}
        pageId="p"
        onChange={onChange}
      />
    )
    await act(async () => {
      slow.resolve(record)
    })
    expect(onChange).not.toHaveBeenCalled()
    expect((screen.getByRole('checkbox', { name: /^全选/ }) as HTMLInputElement).checked).toBe(
      false
    )
  })
})

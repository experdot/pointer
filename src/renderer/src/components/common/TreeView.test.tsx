import { act, render } from '@testing-library/react'
import { App, type TreeProps } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Folder, Page, TreeMove } from '@shared/domain'
import { TreeView } from './TreeView'
import { ConfigTree } from './ConfigTree'

let treeProps: TreeProps
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    Tree: (props: TreeProps) => {
      treeProps = props
      return null
    }
  }
})

const source: Page = { id: 'source', kind: 'page', name: '源', order: 0, createdAt: 1 }
const target: Page = { id: 'target', kind: 'page', name: '目标', order: 1, createdAt: 1 }
const folder: Folder = { id: 'folder', kind: 'folder', name: '文件夹', order: 2, createdAt: 1 }
const onMove = vi.fn<(move: TreeMove) => void>()
const noop = (): void => undefined

function drop(placement: TreeMove['placement'], targetId: string, targetIsFolder = false): void {
  const info = {
    dragNode: { key: source.id },
    node: { key: targetId, pos: '0-3', isFolder: targetIsFolder },
    dropToGap: placement !== 'inside',
    dropPosition: placement === 'before' ? 2 : placement === 'after' ? 4 : 3
  } as unknown as Parameters<NonNullable<TreeProps['onDrop']>>[0]
  act(() => treeProps.onDrop?.(info))
}

beforeEach(() => {
  onMove.mockClear()
})

describe('树组件只解释拖拽位置', () => {
  it.each(['before', 'after', 'inside'] as const)(
    '%s 不计算整层排序，只发出一个移动意图',
    (placement) => {
      render(
        <App>
          <TreeView<Page, Folder>
            items={[source, target]}
            folders={[folder]}
            selectedId={null}
            onSelect={noop}
            itemIcon={null}
            getItemName={(item) => item.name}
            isItem={(item): item is Page => item.kind === 'page'}
            onMove={onMove}
            updateItem={noop}
            deleteItem={noop}
            updateFolder={noop}
            deleteFolder={noop}
            toggleFolderExpanded={noop}
          />
        </App>
      )
      const targetId = placement === 'inside' ? folder.id : target.id
      drop(placement, targetId, placement === 'inside')
      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        nodeId: source.id,
        targetNodeId: targetId,
        placement
      })
    }
  )

  it('设置树继续使用自身的设置更新接口', () => {
    const first = { ...source, kind: 'item' as const }
    const last = { ...target, kind: 'item' as const }
    const update = vi.fn()
    render(
      <App>
        <ConfigTree
          items={[first, last]}
          folders={[]}
          selectedId={null}
          onSelect={noop}
          itemIcon={null}
          itemNameKey="name"
          isItem={(item): item is typeof first => item.kind === 'item'}
          batchUpdateItemsOrder={update}
          createItem={() => first}
          updateItem={noop}
          deleteItem={noop}
          createFolder={() => folder}
          updateFolder={noop}
          deleteFolder={noop}
          toggleFolderExpanded={noop}
        />
      </App>
    )
    drop('after', last.id)
    expect(update).toHaveBeenCalledExactlyOnceWith([last, first], undefined)
  })
})

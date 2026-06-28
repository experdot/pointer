import React, { useMemo } from 'react'
import { TreeSelect, Divider } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../../../stores/settingsStore'
import { openSettings } from '../../../services/settingsService'
import type { LLMConfig, ConfigFolder } from '../../../types/type'
import './ModelSelector.css'

interface ModelSelectorProps {
  value?: string
  onChange?: (llmId: string) => void
  onSelect?: () => void
  size?: 'small' | 'middle' | 'large'
  style?: React.CSSProperties
  variant?: 'outlined' | 'filled' | 'borderless'
  disabled?: boolean
}

interface TreeNode {
  value: string
  title: string
  selectable?: boolean
  children?: TreeNode[]
}

function buildTree(items: LLMConfig[], folders: ConfigFolder[]): TreeNode[] {
  const folderMap = new Map<string | undefined, TreeNode[]>()

  // 初始化根节点
  folderMap.set(undefined, [])

  // 创建文件夹节点
  folders.forEach((folder) => {
    const parentId = folder.parentFolderId
    if (!folderMap.has(parentId)) {
      folderMap.set(parentId, [])
    }
    const node: TreeNode = {
      value: `folder-${folder.id}`,
      title: folder.name,
      selectable: false,
      children: []
    }
    folderMap.get(parentId)!.push(node)
    folderMap.set(folder.id, node.children!)
  })

  // 新建配置项到对应文件夹
  items.forEach((item) => {
    const parentId = item.parentFolderId
    if (!folderMap.has(parentId)) {
      folderMap.set(parentId, [])
    }
    folderMap.get(parentId)!.push({
      value: item.id,
      title: item.name
    })
  })

  return folderMap.get(undefined) || []
}

export function ModelSelector({
  value,
  onChange,
  onSelect,
  size = 'small',
  style,
  variant = 'borderless',
  disabled
}: ModelSelectorProps): React.JSX.Element {
  const { settings, setDefaultLLMId } = useSettingsStore()
  const { items, folders } = settings.llmConfigs

  const currentValue = value ?? settings.defaultLLMId

  const treeData = useMemo(() => buildTree(items, folders), [items, folders])

  const handleChange = (llmId: string): void => {
    if (onChange) {
      onChange(llmId)
    } else {
      setDefaultLLMId(llmId)
    }
    onSelect?.()
  }

  const popupRender = (menu: React.ReactElement): React.ReactElement => (
    <>
      {menu}
      <Divider style={{ margin: '4px 0' }} />
      <div className="model-selector__settings-link" onClick={() => openSettings('llm')}>
        <SettingOutlined /> 管理 LLM 配置
      </div>
    </>
  )

  return (
    <TreeSelect
      className="model-selector"
      size={size}
      style={style}
      value={currentValue}
      onChange={handleChange}
      placeholder="选择模型"
      variant={variant}
      disabled={disabled}
      treeData={treeData}
      treeDefaultExpandAll
      showSearch
      treeNodeFilterProp="title"
      treeLine
      treeExpandAction="click"
      popupMatchSelectWidth={false}
      styles={{ popup: { root: { minWidth: 300 } } }}
      popupRender={popupRender}
    />
  )
}

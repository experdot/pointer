import React, { useState } from 'react'
import { Form, Input, Flex, Empty } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { usePromptLists } from '../../../hooks/useSettings'
import { ConfigTree } from '../../common/ConfigTree'
import type { PromptListConfig, ConfigFolder } from '../../../types/type'

const { TextArea } = Input

export function PromptListPanel(): React.JSX.Element {
  const {
    items,
    folders,
    batchUpdateItemsOrder,
    createConfig,
    updateConfig,
    deleteConfig,
    copyConfig,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolderExpanded
  } = usePromptLists()
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null)

  const selectedConfig = items.find((c) => c.id === selectedId)

  const isItem = (item: PromptListConfig | ConfigFolder): item is PromptListConfig =>
    item.type !== 'folder'

  return (
    <Flex className="settings-config-panel" gap={16}>
      <ConfigTree<PromptListConfig>
        items={items}
        folders={folders}
        selectedId={selectedId}
        onSelect={setSelectedId}
        itemIcon={<FileTextOutlined />}
        itemNameKey="name"
        isItem={isItem}
        batchUpdateItemsOrder={batchUpdateItemsOrder}
        createItem={() => createConfig({ name: '新列表', prompts: [] })}
        updateItem={updateConfig}
        deleteItem={deleteConfig}
        copyItem={copyConfig}
        createFolder={createFolder}
        updateFolder={updateFolder}
        deleteFolder={deleteFolder}
        toggleFolderExpanded={toggleFolderExpanded}
        emptyText="暂无列表"
        addItemText="添加列表"
      />

      <div className="settings-config-detail">
        {selectedConfig ? (
          <Form layout="vertical" key={selectedConfig.id}>
            <Form.Item label="名称">
              <Input
                value={selectedConfig.name}
                onChange={(e) => updateConfig(selectedConfig.id, { name: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="描述">
              <Input
                value={selectedConfig.description}
                onChange={(e) => updateConfig(selectedConfig.id, { description: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="提示词列表（每行一个）">
              <TextArea
                value={selectedConfig.prompts.join('\n')}
                onChange={(e) =>
                  updateConfig(selectedConfig.id, {
                    prompts: e.target.value.split('\n').filter((p) => p.trim())
                  })
                }
                rows={10}
              />
            </Form.Item>
          </Form>
        ) : (
          <Empty description="选择或创建列表" />
        )}
      </div>
    </Flex>
  )
}

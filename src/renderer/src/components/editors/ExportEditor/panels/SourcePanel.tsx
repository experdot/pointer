import { MessageOutlined, FileTextOutlined, TableOutlined, CodeOutlined } from '@ant-design/icons'
import { useExportStore } from '../../../../stores/exportStore'
import { exportManager } from '../../../../features/export'
import type { SourceType } from '../../../../features/export/types'

interface SourcePanelProps {
  pageId?: string
}

// Source type configuration
const SOURCE_TYPES: {
  type: SourceType
  name: string
  icon: React.ReactNode
  description: string
}[] = [
  {
    type: 'messages',
    name: '消息',
    icon: <MessageOutlined />,
    description: '导出聊天消息'
  },
  {
    type: 'text-snippet',
    name: '文本片段',
    icon: <FileTextOutlined />,
    description: '导出文本内容'
  },
  {
    type: 'table-block',
    name: '表格',
    icon: <TableOutlined />,
    description: '导出 Markdown 表格'
  },
  {
    type: 'code-block',
    name: '代码块',
    icon: <CodeOutlined />,
    description: '导出代码块'
  }
]

/**
 * SourcePanel - Left panel for source selection
 *
 * Allows user to:
 * 1. Select source type (messages, text snippet, table, code)
 * 2. Configure source-specific options via plugin selector component
 */
export function SourcePanel({ pageId }: SourcePanelProps): React.JSX.Element {
  const { sourceType, sourceData, setSourceType, setSourceData } = useExportStore()

  const handleSourceTypeChange = (type: SourceType): void => {
    setSourceType(type)
  }

  // Get the source plugin and render its selector component
  const sourcePlugin = sourceType ? exportManager.getSource(sourceType) : null
  const SelectorComponent = sourcePlugin?.SelectorComponent

  return (
    <>
      <div className="export-panel__header">
        <span className="export-panel__header-title">数据源</span>
      </div>
      <div className="export-panel__content">
        {/* Source type selector */}
        <div className="source-panel__type-selector">
          {SOURCE_TYPES.map((source) => (
            <div
              key={source.type}
              className={`source-panel__type-item ${
                sourceType === source.type ? 'source-panel__type-item--active' : ''
              }`}
              onClick={() => handleSourceTypeChange(source.type)}
            >
              {source.icon}
              <div>
                <div style={{ fontWeight: 500 }}>{source.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                  {source.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Source-specific selector */}
        {sourceType && SelectorComponent && (
          <div className="source-panel__selector">
            <SelectorComponent data={sourceData} onChange={setSourceData} pageId={pageId} />
          </div>
        )}

        {/* Placeholder when no source plugin is registered */}
        {sourceType && !SelectorComponent && (
          <div
            style={{ color: 'var(--ant-color-text-secondary)', textAlign: 'center', padding: 24 }}
          >
            该源类型的插件尚未注册
          </div>
        )}
      </div>
    </>
  )
}

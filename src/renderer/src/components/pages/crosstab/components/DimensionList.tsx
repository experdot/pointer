import React from 'react'
import { Space, Tag, Button, Typography } from 'antd'
import { LoadingOutlined, StopOutlined } from '@ant-design/icons'

const { Text } = Typography

interface Dimension {
  id: string
  name: string
  values: any[]
}

interface DimensionListProps {
  title: string
  dimensions: Dimension[]
  dimensionType: 'horizontal' | 'vertical'
  loading: { [dimensionId: string]: boolean }
  onGenerate: (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => void
  onStop: (dimensionId: string) => void
}

export const DimensionList: React.FC<DimensionListProps> = ({
  title,
  dimensions,
  dimensionType,
  loading,
  onGenerate,
  onStop
}) => {
  return (
    <div>
      <Text strong>{title}</Text>
      <Space wrap style={{ marginTop: 8 }}>
        {dimensions.map((dim) => (
          <div key={dim.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Tag
              color={dim.values.length > 0 ? 'green' : 'default'}
              style={{ cursor: 'pointer', margin: 0 }}
              onClick={() => onGenerate(dim.id, dimensionType)}
            >
              {dim.name} ({dim.values.length}个值)
              {loading[dim.id] && <LoadingOutlined style={{ marginLeft: 4 }} />}
            </Tag>
            {loading[dim.id] && (
              <Button
                type="text"
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => onStop(dim.id)}
                style={{ padding: '0 4px', height: '20px' }}
              >
                停止
              </Button>
            )}
          </div>
        ))}
      </Space>
    </div>
  )
}

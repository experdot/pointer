import React from 'react'
import { Pagination } from 'antd'

interface TaskPaginationProps {
  total: number
  current: number
  pageSize: number
  onChange: (page: number) => void
}

export const TaskPagination: React.FC<TaskPaginationProps> = ({
  total,
  current,
  pageSize,
  onChange
}) => {
  if (total <= pageSize) {
    return null
  }

  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <Pagination
        size="small"
        total={total}
        current={current}
        pageSize={pageSize}
        onChange={onChange}
        showSizeChanger={false}
        showQuickJumper={total > pageSize * 5}
      />
    </div>
  )
}

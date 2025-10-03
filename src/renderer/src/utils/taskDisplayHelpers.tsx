import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  MessageOutlined,
  CodeOutlined,
  TableOutlined,
  BulbOutlined
} from '@ant-design/icons'
import type { AITaskStatus, AITaskType } from '../types/type'

export const getTaskIcon = (type: AITaskType) => {
  switch (type) {
    case 'chat':
    case 'retry':
    case 'edit_resend':
    case 'model_change':
      return <MessageOutlined />
    case 'crosstab_cell':
      return <TableOutlined />
    case 'object_generation':
      return <BulbOutlined />
    default:
      return <MessageOutlined />
  }
}

export const getTaskStatusDisplay = (status: AITaskStatus) => {
  switch (status) {
    case 'running':
      return {
        text: '运行中',
        color: 'processing',
        icon: <ClockCircleOutlined />
      }
    case 'completed':
      return {
        text: '已完成',
        color: 'success',
        icon: <CheckCircleOutlined />
      }
    case 'failed':
      return {
        text: '失败',
        color: 'error',
        icon: <CloseCircleOutlined />
      }
    case 'cancelled':
      return {
        text: '已取消',
        color: 'default',
        icon: <StopOutlined />
      }
    default:
      return {
        text: '未知',
        color: 'default',
        icon: <ClockCircleOutlined />
      }
  }
}

export const getTaskTypeName = (type: AITaskType): string => {
  switch (type) {
    case 'chat':
      return '对话'
    case 'retry':
      return '重试'
    case 'edit_resend':
      return '编辑重发'
    case 'model_change':
      return '模型切换'
    case 'crosstab_cell':
      return '交叉表单元格'
    case 'object_generation':
      return '对象生成'
    default:
      return '未知'
  }
}

export const formatDuration = (startTime: number, endTime?: number): string => {
  const duration = endTime ? endTime - startTime : Date.now() - startTime
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`
  } else {
    return `${seconds}秒`
  }
}

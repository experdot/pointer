import { v4 as uuidv4 } from 'uuid'
import { ObjectNode } from '../../../../types/type'

export const generateId = (): string => {
  return uuidv4()
}

export const createMetadata = () => ({
  createdAt: Date.now(),
  source: 'user' as const
})

interface CreateNodeParams {
  name: string
  description?: string
  type?: 'entity' | 'relation' | 'attribute' | 'group'
  parentId: string
  properties?: Record<string, any>
  children?: string[]
  expanded?: boolean
}

export const createNode = ({
  name,
  description = '',
  type = 'entity',
  parentId,
  properties = {},
  children = [],
  expanded = false
}: CreateNodeParams): { id: string; node: ObjectNode } => {
  const id = generateId()
  const node: ObjectNode = {
    id,
    name,
    description,
    type,
    parentId,
    children,
    expanded,
    metadata: createMetadata(),
    properties
  }
  return { id, node }
}

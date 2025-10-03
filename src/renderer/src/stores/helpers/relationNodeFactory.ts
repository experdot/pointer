import { v4 as uuidv4 } from 'uuid'
import { ObjectNode } from '../../types/type'

// 关系节点配置接口
interface RelationConfig {
  name: string
  type: string
  description: string
  category: string
  example?: string
  isTransitive?: boolean
  isSymmetric?: boolean
  isAbstract?: boolean
  inverseOf?: string
}

// 关系节点工厂函数
export const createRelationNode = (
  config: RelationConfig,
  parentId: string,
  timestamp: number
): { id: string; node: ObjectNode } => {
  const id = uuidv4()

  const properties: Record<string, any> = {
    category: config.category
  }

  if (config.example) properties.example = config.example
  if (config.isTransitive !== undefined) properties.isTransitive = config.isTransitive
  if (config.isSymmetric !== undefined) properties.isSymmetric = config.isSymmetric
  if (config.isAbstract !== undefined) properties.isAbstract = config.isAbstract
  if (config.inverseOf) properties.inverseOf = config.inverseOf

  const node: ObjectNode = {
    id,
    name: config.name,
    type: config.type as any,
    description: config.description,
    parentId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: parentId,
        role: 'subclass-of',
        description: `${config.name}是一般关联的子类`
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties
  }

  return { id, node }
}

// 预定义的关系类型配置
export const RELATION_CONFIGS: RelationConfig[] = [
  {
    name: '继承关系 (is-a)',
    type: 'relation',
    description: '表示类与子类或实例的关系，A是B的一种',
    category: '继承/分类',
    isTransitive: true,
    example: '(猫) -is-a-> (动物)'
  },
  {
    name: '构成关系 (part-of)',
    type: 'relation',
    description: '表示某个事物是另一个事物的一部分',
    category: '构成/包含',
    isTransitive: true,
    example: '(引擎) -part-of-> (汽车)'
  },
  {
    name: '包含关系 (has-part)',
    type: 'relation',
    description: '表示某个事物包含另一个事物作为其组成部分',
    category: '构成/包含',
    inverseOf: 'part-of',
    example: '(汽车) -has-part-> (引擎)'
  },
  {
    name: '属性关系 (has-property)',
    type: 'relation',
    description: '表示某个实体具有某个属性或特征',
    category: '属性/特征',
    example: '(乌鸦) -has-property-> (颜色:黑色)'
  },
  {
    name: '属性归属 (property-of)',
    type: 'relation',
    description: '表示某个属性或特征归属于某个实体',
    category: '属性/特征',
    inverseOf: 'has-property',
    example: '(颜色:黑色) -property-of-> (乌鸦)'
  },
  {
    name: '功能关系 (is-used-for)',
    type: 'relation',
    description: '表示某个事物被用于某个目的或功能',
    category: '功能/目的',
    example: '(锤子) -is-used-for-> (敲钉子)'
  },
  {
    name: '目的关系 (has-purpose)',
    type: 'relation',
    description: '表示某个事物具有某个目的或意图',
    category: '功能/目的',
    example: '(法律) -has-purpose-> (维护社会秩序)'
  },
  {
    name: '因果关系 (causes)',
    type: 'relation',
    description: '表示某个事件或状态导致另一个事件或状态',
    category: '因果关系',
    isTransitive: true,
    example: '(长期干旱) -causes-> (粮食危机)'
  },
  {
    name: '被因果关系 (caused-by)',
    type: 'relation',
    description: '表示某个事件或状态由另一个事件或状态引起',
    category: '因果关系',
    inverseOf: 'causes',
    example: '(粮食危机) -caused-by-> (长期干旱)'
  },
  {
    name: '位置关系 (located-at)',
    type: 'relation',
    description: '表示某个实体位于某个位置',
    category: '空间关系',
    example: '(埃菲尔铁塔) -located-at-> (巴黎)'
  },
  {
    name: '空间包含 (contains)',
    type: 'relation',
    description: '表示某个空间区域包含另一个实体',
    category: '空间关系',
    inverseOf: 'located-at',
    example: '(巴黎) -contains-> (埃菲尔铁塔)'
  },
  {
    name: '对立关系 (is-opposed-to)',
    type: 'relation',
    description: '表示两个事物之间存在对立或冲突',
    category: '对立关系',
    isSymmetric: true,
    example: '(光明魔法) -is-opposed-to-> (黑暗魔法)'
  },
  {
    name: '冲突关系 (conflicts-with)',
    type: 'relation',
    description: '表示两个事物之间存在冲突或矛盾',
    category: '对立关系',
    isSymmetric: true,
    example: '(自由意志) -conflicts-with-> (宿命论)'
  }
]

// 创建继承关系实例节点
export const createInheritanceInstanceNode = (
  relationId: string,
  relationName: string,
  generalRelationId: string,
  isARelationId: string,
  parentId: string,
  timestamp: number
): { id: string; node: ObjectNode } => {
  const id = uuidv4()

  const node: ObjectNode = {
    id,
    name: `${relationName} 继承自 一般关联`,
    type: 'relation',
    description: `表示${relationName}是一般关联的子类这一事实`,
    parentId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: relationId,
        role: 'subject',
        description: `${relationName}作为主语`
      },
      {
        nodeId: generalRelationId,
        role: 'object',
        description: '一般关联作为宾语'
      },
      {
        nodeId: isARelationId,
        role: 'instance-of',
        description: '这个继承关系实例本身也是继承关系的一个实例'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      relationshipType: 'inheritance',
      subject: relationName,
      object: '一般关联'
    }
  }

  return { id, node }
}

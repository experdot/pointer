import { v4 as uuidv4 } from 'uuid'
import {
  Page,
  PageFolder,
  CrosstabChat,
  CrosstabData,
  CrosstabStep,
  RegularChat,
  ObjectChat,
  ObjectData,
  ObjectNode,
  PageLineage
} from '../types/type'
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from './constants'

// 创建包含元关系的根节点结构
export const createObjectRootWithMetaRelations = (): {
  rootNodeId: string
  nodes: { [nodeId: string]: ObjectNode }
  expandedNodes: string[]
} => {
  const rootId = uuidv4()
  const timestamp = Date.now()

  // 创建元关系节点
  const metaRelationsId = uuidv4()
  const generalRelationId = uuidv4()

  // 创建具体的关系节点
  const isARelationId = uuidv4()
  const partOfRelationId = uuidv4()
  const hasPartRelationId = uuidv4()
  const hasPropertyRelationId = uuidv4()
  const propertyOfRelationId = uuidv4()
  const isUsedForRelationId = uuidv4()
  const hasPurposeRelationId = uuidv4()
  const causesRelationId = uuidv4()
  const causedByRelationId = uuidv4()
  const locatedAtRelationId = uuidv4()
  const containsRelationId = uuidv4()
  const isOpposedToRelationId = uuidv4()
  const conflictsWithRelationId = uuidv4()

  // 创建具体的继承关系实例节点
  const inheritanceInstancesId = uuidv4()
  const isAInheritanceId = uuidv4()
  const partOfInheritanceId = uuidv4()
  const hasPartInheritanceId = uuidv4()
  const hasPropertyInheritanceId = uuidv4()
  const propertyOfInheritanceId = uuidv4()
  const isUsedForInheritanceId = uuidv4()
  const hasPurposeInheritanceId = uuidv4()
  const causesInheritanceId = uuidv4()
  const causedByInheritanceId = uuidv4()
  const locatedAtInheritanceId = uuidv4()
  const containsInheritanceId = uuidv4()
  const isOpposedToInheritanceId = uuidv4()
  const conflictsWithInheritanceId = uuidv4()

  const rootNode: ObjectNode = {
    id: rootId,
    name: '根对象',
    type: 'entity',
    description: '对象的根节点',
    children: [metaRelationsId],
    expanded: true,
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {}
  }

  // 元关系容器节点
  const metaRelationsNode: ObjectNode = {
    id: metaRelationsId,
    name: '元关系',
    type: 'container',
    description: '预定义的基础关系类型，用于构建知识图谱',
    parentId: rootId,
    children: [generalRelationId, inheritanceInstancesId],
    expanded: true,
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {}
  }

  // 一般关联节点 - 所有关系的基类
  const generalRelationNode: ObjectNode = {
    id: generalRelationId,
    name: '一般关联 (is-related-to)',
    type: 'relation',
    description: '所有关系的基类，表示两个事物之间存在某种联系',
    parentId: metaRelationsId,
    children: [
      isARelationId,
      partOfRelationId,
      hasPartRelationId,
      hasPropertyRelationId,
      propertyOfRelationId,
      isUsedForRelationId,
      hasPurposeRelationId,
      causesRelationId,
      causedByRelationId,
      locatedAtRelationId,
      containsRelationId,
      isOpposedToRelationId,
      conflictsWithRelationId
    ],
    expanded: true,
    connections: [
      {
        nodeId: isARelationId,
        role: 'superclass-of',
        description: '一般关联是继承关系的超类'
      },
      {
        nodeId: partOfRelationId,
        role: 'superclass-of',
        description: '一般关联是构成关系的超类'
      },
      {
        nodeId: hasPartRelationId,
        role: 'superclass-of',
        description: '一般关联是包含关系的超类'
      },
      {
        nodeId: hasPropertyRelationId,
        role: 'superclass-of',
        description: '一般关联是属性关系的超类'
      },
      {
        nodeId: propertyOfRelationId,
        role: 'superclass-of',
        description: '一般关联是属性归属关系的超类'
      },
      {
        nodeId: isUsedForRelationId,
        role: 'superclass-of',
        description: '一般关联是功能关系的超类'
      },
      {
        nodeId: hasPurposeRelationId,
        role: 'superclass-of',
        description: '一般关联是目的关系的超类'
      },
      {
        nodeId: causesRelationId,
        role: 'superclass-of',
        description: '一般关联是因果关系的超类'
      },
      {
        nodeId: causedByRelationId,
        role: 'superclass-of',
        description: '一般关联是被因果关系的超类'
      },
      {
        nodeId: locatedAtRelationId,
        role: 'superclass-of',
        description: '一般关联是位置关系的超类'
      },
      {
        nodeId: containsRelationId,
        role: 'superclass-of',
        description: '一般关联是空间包含关系的超类'
      },
      {
        nodeId: isOpposedToRelationId,
        role: 'superclass-of',
        description: '一般关联是对立关系的超类'
      },
      {
        nodeId: conflictsWithRelationId,
        role: 'superclass-of',
        description: '一般关联是冲突关系的超类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '基础关系',
      isAbstract: true
    }
  }

  // 继承/分类关系
  const isARelationNode: ObjectNode = {
    id: isARelationId,
    name: '继承关系 (is-a)',
    type: 'relation',
    description: '表示类与子类或实例的关系，A是B的一种',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '继承关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '继承/分类',
      isTransitive: true,
      example: '(猫) -is-a-> (动物)'
    }
  }

  // 构成关系 - part-of
  const partOfRelationNode: ObjectNode = {
    id: partOfRelationId,
    name: '构成关系 (part-of)',
    type: 'relation',
    description: '表示某个事物是另一个事物的一部分',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '构成关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '构成/包含',
      isTransitive: true,
      example: '(引擎) -part-of-> (汽车)'
    }
  }

  // 包含关系 - has-part
  const hasPartRelationNode: ObjectNode = {
    id: hasPartRelationId,
    name: '包含关系 (has-part)',
    type: 'relation',
    description: '表示某个事物包含另一个事物作为其组成部分',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '包含关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '构成/包含',
      inverseOf: 'part-of',
      example: '(汽车) -has-part-> (引擎)'
    }
  }

  // 属性关系 - has-property
  const hasPropertyRelationNode: ObjectNode = {
    id: hasPropertyRelationId,
    name: '属性关系 (has-property)',
    type: 'relation',
    description: '表示某个实体具有某个属性或特征',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '属性关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '属性/特征',
      example: '(乌鸦) -has-property-> (颜色:黑色)'
    }
  }

  // 属性归属关系 - property-of
  const propertyOfRelationNode: ObjectNode = {
    id: propertyOfRelationId,
    name: '属性归属 (property-of)',
    type: 'relation',
    description: '表示某个属性或特征归属于某个实体',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '属性归属关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '属性/特征',
      inverseOf: 'has-property',
      example: '(颜色:黑色) -property-of-> (乌鸦)'
    }
  }

  // 功能关系 - is-used-for
  const isUsedForRelationNode: ObjectNode = {
    id: isUsedForRelationId,
    name: '功能关系 (is-used-for)',
    type: 'relation',
    description: '表示某个事物被用于某个目的或功能',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '功能关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '功能/目的',
      example: '(锤子) -is-used-for-> (敲钉子)'
    }
  }

  // 目的关系 - has-purpose
  const hasPurposeRelationNode: ObjectNode = {
    id: hasPurposeRelationId,
    name: '目的关系 (has-purpose)',
    type: 'relation',
    description: '表示某个事物具有某个目的或意图',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '目的关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '功能/目的',
      example: '(法律) -has-purpose-> (维护社会秩序)'
    }
  }

  // 因果关系 - causes
  const causesRelationNode: ObjectNode = {
    id: causesRelationId,
    name: '因果关系 (causes)',
    type: 'relation',
    description: '表示某个事件或状态导致另一个事件或状态',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '因果关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '因果关系',
      isTransitive: true,
      example: '(长期干旱) -causes-> (粮食危机)'
    }
  }

  // 被因果关系 - caused-by
  const causedByRelationNode: ObjectNode = {
    id: causedByRelationId,
    name: '被因果关系 (caused-by)',
    type: 'relation',
    description: '表示某个事件或状态由另一个事件或状态引起',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '被因果关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '因果关系',
      inverseOf: 'causes',
      example: '(粮食危机) -caused-by-> (长期干旱)'
    }
  }

  // 位置关系 - located-at
  const locatedAtRelationNode: ObjectNode = {
    id: locatedAtRelationId,
    name: '位置关系 (located-at)',
    type: 'relation',
    description: '表示某个实体位于某个位置',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '位置关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '空间关系',
      example: '(埃菲尔铁塔) -located-at-> (巴黎)'
    }
  }

  // 空间包含关系 - contains
  const containsRelationNode: ObjectNode = {
    id: containsRelationId,
    name: '空间包含 (contains)',
    type: 'relation',
    description: '表示某个空间区域包含另一个实体',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '空间包含关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '空间关系',
      inverseOf: 'located-at',
      example: '(巴黎) -contains-> (埃菲尔铁塔)'
    }
  }

  // 对立关系 - is-opposed-to
  const isOpposedToRelationNode: ObjectNode = {
    id: isOpposedToRelationId,
    name: '对立关系 (is-opposed-to)',
    type: 'relation',
    description: '表示两个事物之间存在对立或冲突',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '对立关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '对立关系',
      isSymmetric: true,
      example: '(光明魔法) -is-opposed-to-> (黑暗魔法)'
    }
  }

  // 冲突关系 - conflicts-with
  const conflictsWithRelationNode: ObjectNode = {
    id: conflictsWithRelationId,
    name: '冲突关系 (conflicts-with)',
    type: 'relation',
    description: '表示两个事物之间存在冲突或矛盾',
    parentId: generalRelationId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: generalRelationId,
        role: 'subclass-of',
        description: '冲突关系是一般关联的子类'
      }
    ],
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {
      category: '对立关系',
      isSymmetric: true,
      example: '(自由意志) -conflicts-with-> (宿命论)'
    }
  }

  // 继承关系实例容器节点
  const inheritanceInstancesNode: ObjectNode = {
    id: inheritanceInstancesId,
    name: '继承关系实例',
    type: 'container',
    description: '具体的继承关系实例，表示每个关系与一般关联之间的继承关系',
    parentId: metaRelationsId,
    children: [
      isAInheritanceId,
      partOfInheritanceId,
      hasPartInheritanceId,
      hasPropertyInheritanceId,
      propertyOfInheritanceId,
      isUsedForInheritanceId,
      hasPurposeInheritanceId,
      causesInheritanceId,
      causedByInheritanceId,
      locatedAtInheritanceId,
      containsInheritanceId,
      isOpposedToInheritanceId,
      conflictsWithInheritanceId
    ],
    expanded: true,
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {}
  }

  // 继承关系实例节点 - 每个都表示一个具体的继承关系
  const isAInheritanceNode: ObjectNode = {
    id: isAInheritanceId,
    name: '继承关系 继承自 一般关联',
    type: 'relation',
    description: '表示继承关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: isARelationId,
        role: 'subject',
        description: '继承关系作为主语'
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
      subject: '继承关系',
      object: '一般关联'
    }
  }

  const partOfInheritanceNode: ObjectNode = {
    id: partOfInheritanceId,
    name: '构成关系 继承自 一般关联',
    type: 'relation',
    description: '表示构成关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: partOfRelationId,
        role: 'subject',
        description: '构成关系作为主语'
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
      subject: '构成关系',
      object: '一般关联'
    }
  }

  const hasPartInheritanceNode: ObjectNode = {
    id: hasPartInheritanceId,
    name: '包含关系 继承自 一般关联',
    type: 'relation',
    description: '表示包含关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: hasPartRelationId,
        role: 'subject',
        description: '包含关系作为主语'
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
      subject: '包含关系',
      object: '一般关联'
    }
  }

  const hasPropertyInheritanceNode: ObjectNode = {
    id: hasPropertyInheritanceId,
    name: '属性关系 继承自 一般关联',
    type: 'relation',
    description: '表示属性关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: hasPropertyRelationId,
        role: 'subject',
        description: '属性关系作为主语'
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
      subject: '属性关系',
      object: '一般关联'
    }
  }

  const propertyOfInheritanceNode: ObjectNode = {
    id: propertyOfInheritanceId,
    name: '属性归属关系 继承自 一般关联',
    type: 'relation',
    description: '表示属性归属关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: propertyOfRelationId,
        role: 'subject',
        description: '属性归属关系作为主语'
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
      subject: '属性归属关系',
      object: '一般关联'
    }
  }

  const isUsedForInheritanceNode: ObjectNode = {
    id: isUsedForInheritanceId,
    name: '功能关系 继承自 一般关联',
    type: 'relation',
    description: '表示功能关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: isUsedForRelationId,
        role: 'subject',
        description: '功能关系作为主语'
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
      subject: '功能关系',
      object: '一般关联'
    }
  }

  const hasPurposeInheritanceNode: ObjectNode = {
    id: hasPurposeInheritanceId,
    name: '目的关系 继承自 一般关联',
    type: 'relation',
    description: '表示目的关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: hasPurposeRelationId,
        role: 'subject',
        description: '目的关系作为主语'
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
      subject: '目的关系',
      object: '一般关联'
    }
  }

  const causesInheritanceNode: ObjectNode = {
    id: causesInheritanceId,
    name: '因果关系 继承自 一般关联',
    type: 'relation',
    description: '表示因果关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: causesRelationId,
        role: 'subject',
        description: '因果关系作为主语'
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
      subject: '因果关系',
      object: '一般关联'
    }
  }

  const causedByInheritanceNode: ObjectNode = {
    id: causedByInheritanceId,
    name: '被因果关系 继承自 一般关联',
    type: 'relation',
    description: '表示被因果关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: causedByRelationId,
        role: 'subject',
        description: '被因果关系作为主语'
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
      subject: '被因果关系',
      object: '一般关联'
    }
  }

  const locatedAtInheritanceNode: ObjectNode = {
    id: locatedAtInheritanceId,
    name: '位置关系 继承自 一般关联',
    type: 'relation',
    description: '表示位置关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: locatedAtRelationId,
        role: 'subject',
        description: '位置关系作为主语'
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
      subject: '位置关系',
      object: '一般关联'
    }
  }

  const containsInheritanceNode: ObjectNode = {
    id: containsInheritanceId,
    name: '空间包含关系 继承自 一般关联',
    type: 'relation',
    description: '表示空间包含关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: containsRelationId,
        role: 'subject',
        description: '空间包含关系作为主语'
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
      subject: '空间包含关系',
      object: '一般关联'
    }
  }

  const isOpposedToInheritanceNode: ObjectNode = {
    id: isOpposedToInheritanceId,
    name: '对立关系 继承自 一般关联',
    type: 'relation',
    description: '表示对立关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: isOpposedToRelationId,
        role: 'subject',
        description: '对立关系作为主语'
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
      subject: '对立关系',
      object: '一般关联'
    }
  }

  const conflictsWithInheritanceNode: ObjectNode = {
    id: conflictsWithInheritanceId,
    name: '冲突关系 继承自 一般关联',
    type: 'relation',
    description: '表示冲突关系是一般关联的子类这一事实',
    parentId: inheritanceInstancesId,
    children: [],
    expanded: false,
    connections: [
      {
        nodeId: conflictsWithRelationId,
        role: 'subject',
        description: '冲突关系作为主语'
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
      subject: '冲突关系',
      object: '一般关联'
    }
  }

  // 创建所有节点的映射
  const nodes = {
    [rootId]: rootNode,
    [metaRelationsId]: metaRelationsNode,
    [generalRelationId]: generalRelationNode,
    [isARelationId]: isARelationNode,
    [partOfRelationId]: partOfRelationNode,
    [hasPartRelationId]: hasPartRelationNode,
    [hasPropertyRelationId]: hasPropertyRelationNode,
    [propertyOfRelationId]: propertyOfRelationNode,
    [isUsedForRelationId]: isUsedForRelationNode,
    [hasPurposeRelationId]: hasPurposeRelationNode,
    [causesRelationId]: causesRelationNode,
    [causedByRelationId]: causedByRelationNode,
    [locatedAtRelationId]: locatedAtRelationNode,
    [containsRelationId]: containsRelationNode,
    [isOpposedToRelationId]: isOpposedToRelationNode,
    [conflictsWithRelationId]: conflictsWithRelationNode,
    [inheritanceInstancesId]: inheritanceInstancesNode,
    [isAInheritanceId]: isAInheritanceNode,
    [partOfInheritanceId]: partOfInheritanceNode,
    [hasPartInheritanceId]: hasPartInheritanceNode,
    [hasPropertyInheritanceId]: hasPropertyInheritanceNode,
    [propertyOfInheritanceId]: propertyOfInheritanceNode,
    [isUsedForInheritanceId]: isUsedForInheritanceNode,
    [hasPurposeInheritanceId]: hasPurposeInheritanceNode,
    [causesInheritanceId]: causesInheritanceNode,
    [causedByInheritanceId]: causedByInheritanceNode,
    [locatedAtInheritanceId]: locatedAtInheritanceNode,
    [containsInheritanceId]: containsInheritanceNode,
    [isOpposedToInheritanceId]: isOpposedToInheritanceNode,
    [conflictsWithInheritanceId]: conflictsWithInheritanceNode
  }

  return {
    rootNodeId: rootId,
    nodes,
    expandedNodes: [rootId, metaRelationsId, generalRelationId, inheritanceInstancesId]
  }
}

// Chat helpers
export const createNewChat = (
  title: string,
  folderId?: string,
  lineage?: PageLineage
): RegularChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  return {
    id: chatId,
    title,
    type: 'regular',
    messages: [],
    messageMap: {},
    currentPath: [],
    rootMessageId: undefined,
    folderId,
    createdAt: timestamp,
    updatedAt: timestamp,
    order: timestamp,
    lineage
  }
}

// 创建交叉视图聊天的helper函数
export const createNewCrosstabChat = (
  title: string,
  folderId?: string,
  lineage?: PageLineage
): CrosstabChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  // 创建初始步骤
  const initialSteps: CrosstabStep[] = [
    {
      id: uuidv4(),
      stepType: 'metadata',
      stepName: '生成主题元数据',
      description: '根据用户输入主题生成多维度交叉表结构的JSON',
      prompt: '',
      isCompleted: false,
      timestamp
    }
  ]

  const crosstabData: CrosstabData = {
    metadata: null,
    tableData: {},
    currentStep: 0,
    steps: initialSteps
  }

  return {
    id: chatId,
    title,
    type: 'crosstab',
    crosstabData,
    createdAt: timestamp,
    updatedAt: timestamp,
    folderId,
    order: timestamp,
    lineage: lineage || {
      source: 'user',
      generatedPageIds: []
    }
  }
}

// 创建对象聊天的helper函数
export const createNewObjectChat = (
  title: string,
  folderId?: string,
  lineage?: PageLineage
): ObjectChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  // 使用统一的函数创建包含元关系的根节点结构
  const { rootNodeId, nodes, expandedNodes } = createObjectRootWithMetaRelations()

  const objectData: ObjectData = {
    rootNodeId,
    nodes,
    selectedNodeId: undefined,
    expandedNodes,
    searchQuery: undefined,
    filteredNodeIds: undefined,
    generationHistory: []
  }

  return {
    id: chatId,
    title,
    type: 'object',
    objectData,
    folderId,
    createdAt: timestamp,
    updatedAt: timestamp,
    order: timestamp,
    lineage
  }
}

// 对象操作辅助函数

// 生成唯一节点ID
export const generateNodeId = (): string => {
  return uuidv4()
}

// 添加节点到对象数据
export const addNodeToObjectData = (
  objectData: ObjectData,
  node: ObjectNode,
  parentId?: string
): ObjectData => {
  const newNodes = { ...objectData.nodes, [node.id]: node }

  // 如果指定了父节点，更新父节点的children数组
  if (parentId && newNodes[parentId]) {
    const parentNode = newNodes[parentId]
    newNodes[parentId] = {
      ...parentNode,
      children: [...(parentNode.children || []), node.id]
    }

    // 更新子节点的parentId
    newNodes[node.id] = { ...node, parentId }
  }

  return {
    ...objectData,
    nodes: newNodes
  }
}

// 删除节点及其所有子节点
export const deleteNodeFromObjectData = (objectData: ObjectData, nodeId: string): ObjectData => {
  const nodesToDelete = getNodeAndAllChildren(objectData.nodes, nodeId)
  const newNodes = { ...objectData.nodes }

  // 删除所有相关节点
  nodesToDelete.forEach((id) => {
    delete newNodes[id]
  })

  // 从父节点的children中移除
  const nodeToDelete = objectData.nodes[nodeId]
  if (nodeToDelete?.parentId && newNodes[nodeToDelete.parentId]) {
    const parentNode = newNodes[nodeToDelete.parentId]
    newNodes[nodeToDelete.parentId] = {
      ...parentNode,
      children: (parentNode.children || []).filter((id) => id !== nodeId)
    }
  }

  return {
    ...objectData,
    nodes: newNodes,
    selectedNodeId: objectData.selectedNodeId === nodeId ? undefined : objectData.selectedNodeId,
    expandedNodes: objectData.expandedNodes.filter((id) => !nodesToDelete.includes(id))
  }
}

// 清空节点的所有子节点
export const clearNodeChildren = (objectData: ObjectData, nodeId: string): ObjectData => {
  const parentNode = objectData.nodes[nodeId]
  if (!parentNode || !parentNode.children || parentNode.children.length === 0) {
    return objectData
  }

  // 获取所有要删除的子节点（包括递归的子节点）
  const nodesToDelete: string[] = []
  parentNode.children.forEach((childId) => {
    nodesToDelete.push(...getNodeAndAllChildren(objectData.nodes, childId))
  })

  const newNodes = { ...objectData.nodes }

  // 删除所有子节点
  nodesToDelete.forEach((id) => {
    delete newNodes[id]
  })

  // 清空父节点的children数组
  newNodes[nodeId] = {
    ...parentNode,
    children: []
  }

  return {
    ...objectData,
    nodes: newNodes,
    selectedNodeId: nodesToDelete.includes(objectData.selectedNodeId || '')
      ? undefined
      : objectData.selectedNodeId,
    expandedNodes: objectData.expandedNodes.filter((id) => !nodesToDelete.includes(id))
  }
}

// 获取节点及其所有子节点的ID列表
const getNodeAndAllChildren = (nodes: { [id: string]: ObjectNode }, nodeId: string): string[] => {
  const result = [nodeId]
  const node = nodes[nodeId]

  if (node?.children) {
    node.children.forEach((childId) => {
      result.push(...getNodeAndAllChildren(nodes, childId))
    })
  }

  return result
}

// 更新节点
export const updateNodeInObjectData = (
  objectData: ObjectData,
  nodeId: string,
  updates: Partial<ObjectNode>
): ObjectData => {
  const existingNode = objectData.nodes[nodeId]
  if (!existingNode) return objectData

  const updatedNode = {
    ...existingNode,
    ...updates,
    metadata: {
      ...existingNode.metadata,
      ...updates.metadata,
      updatedAt: Date.now()
    }
  }

  return {
    ...objectData,
    nodes: {
      ...objectData.nodes,
      [nodeId]: updatedNode
    }
  }
}

// 切换节点展开状态
export const toggleNodeExpansion = (objectData: ObjectData, nodeId: string): ObjectData => {
  const isExpanded = objectData.expandedNodes.includes(nodeId)

  return {
    ...objectData,
    expandedNodes: isExpanded
      ? objectData.expandedNodes.filter((id) => id !== nodeId)
      : [...objectData.expandedNodes, nodeId]
  }
}

// 展开节点
export const expandNode = (objectData: ObjectData, nodeId: string): ObjectData => {
  if (objectData.expandedNodes.includes(nodeId)) return objectData

  return {
    ...objectData,
    expandedNodes: [...objectData.expandedNodes, nodeId]
  }
}

// 折叠节点
export const collapseNode = (objectData: ObjectData, nodeId: string): ObjectData => {
  return {
    ...objectData,
    expandedNodes: objectData.expandedNodes.filter((id) => id !== nodeId)
  }
}

export const updatePageById = (pages: Page[], chatId: string, updates: Partial<Page>): Page[] =>
  pages.map((page) => (page.id === chatId ? { ...page, ...updates, updatedAt: Date.now() } : page))

// Folder helpers
export const createNewFolder = (name: string, parentId?: string): PageFolder => ({
  id: uuidv4(),
  name,
  expanded: true,
  createdAt: Date.now(),
  order: Date.now(), // 使用创建时间作为默认排序
  parentId
})

export const updateFolderById = (
  folders: PageFolder[],
  folderId: string,
  updates: Partial<PageFolder>
): PageFolder[] =>
  folders.map((folder) => (folder.id === folderId ? { ...folder, ...updates } : folder))

// Generic helpers
export const removeFromArray = <T extends { id: string }>(array: T[], id: string): T[] =>
  array.filter((item) => item.id !== id)

export const constrainSidebarWidth = (width: number): number =>
  Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width))

/**
 * 展示层使用的共享类型出口
 *
 * 领域模型与内核契约都来自 shared，这里只是一个便于引用的聚合入口；
 * 展示层不再定义自己的实体类型。
 */

export * from '@shared/domain'
export * from '@shared/contracts'

export type { Page as PageRecord, Conversation as MessagesRecord } from '@shared/domain'

import type {
  SearchMessageGroup as DomainMessageGroup,
  SearchPageGroup as DomainPageGroup
} from '@shared/domain'

/** 检索结果的展开状态属于界面，挂在视图类型上 */
export interface SearchMessageGroup extends DomainMessageGroup {
  expanded?: boolean
}

export interface SearchPageGroup extends Omit<DomainPageGroup, 'messageGroups'> {
  expanded?: boolean
  messageGroups: SearchMessageGroup[]
}

/**
 * 内核端口与 IPC 通道定义
 *
 * 渲染进程只能看到这一层：查询、命令、事件订阅。
 * 文件路径、文件格式、锁与队列都属于内核内部实现。
 */

import type { RuntimeCommandName, RuntimeCommandPayload, RuntimeCommandResult } from './commands'
import type { RuntimeEvent } from './events'
import type { RuntimeQueryName, RuntimeQueryPayload, RuntimeQueryResult } from './queries'

export interface RuntimePort {
  query<K extends RuntimeQueryName>(
    name: K,
    payload: RuntimeQueryPayload<K>
  ): Promise<RuntimeQueryResult<K>>
  command<K extends RuntimeCommandName>(
    name: K,
    payload: RuntimeCommandPayload<K>
  ): Promise<RuntimeCommandResult<K>>
  subscribe(listener: (event: RuntimeEvent) => void): () => void
}

/** IPC 通道 */
export const RUNTIME_CHANNELS = {
  query: 'runtime:query',
  command: 'runtime:command',
  event: 'runtime:event'
} as const

export interface RuntimeQueryRequest {
  name: RuntimeQueryName
  payload: unknown
}

export interface RuntimeCommandRequest {
  name: RuntimeCommandName
  payload: unknown
}

interface RuntimeSuccess<T = unknown> {
  ok: true
  value: T
}

interface RuntimeFailure {
  ok: false
  code: string
  message: string
  details?: unknown
}

export type RuntimeResponse<T = unknown> = RuntimeSuccess<T> | RuntimeFailure

/** 内核抛出的领域错误，携带稳定错误码 */
export class RuntimeError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'RuntimeError'
    this.code = code
    this.details = details
  }
}

export function toFailure(error: unknown): RuntimeFailure {
  if (error instanceof RuntimeError) {
    return { ok: false, code: error.code, message: error.message, details: error.details }
  }
  if (error instanceof Error) {
    return { ok: false, code: 'runtime.error', message: error.message }
  }
  return { ok: false, code: 'runtime.error', message: String(error) }
}

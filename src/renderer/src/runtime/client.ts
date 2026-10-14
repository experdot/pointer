/**
 * 内核客户端
 *
 * 展示层访问数据的唯一入口：查询、命令、事件订阅。
 * 组件与 store 不应直接访问 window.runtime。
 */

import type {
  RuntimeCommandName,
  RuntimeCommandPayload,
  RuntimeCommandResult,
  RuntimePort,
  RuntimeQueryName,
  RuntimeQueryPayload,
  RuntimeQueryResult
} from '@shared/contracts'

function port(): RuntimePort {
  const runtime = window.runtime
  if (!runtime) {
    throw new Error('内核端口不可用：preload 未注入 window.runtime')
  }
  return runtime
}

export function query<K extends RuntimeQueryName>(
  name: K,
  payload: RuntimeQueryPayload<K>
): Promise<RuntimeQueryResult<K>> {
  return port().query(name, payload)
}

export function command<K extends RuntimeCommandName>(
  name: K,
  payload: RuntimeCommandPayload<K>
): Promise<RuntimeCommandResult<K>> {
  return port().command(name, payload)
}

export function subscribe(listener: Parameters<RuntimePort['subscribe']>[0]): () => void {
  return port().subscribe(listener)
}

export function isRuntimeError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && (error as Error & { code?: string }).code !== undefined
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

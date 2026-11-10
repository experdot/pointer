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
import { RuntimeError } from '@shared/contracts'
import { useSessionStore } from '../stores/sessionStore'

const queries = new Map<string, number>()
let sequence = 0
export function resetQueries(): void {
  queries.clear()
}

function port(): RuntimePort {
  const runtime = window.runtime
  if (!runtime) {
    throw new Error('内核端口不可用：preload 未注入 window.runtime')
  }
  return runtime
}

export async function query<K extends RuntimeQueryName>(
  name: K,
  payload: RuntimeQueryPayload<K>
): Promise<RuntimeQueryResult<K>> {
  const scopeId = useSessionStore.getState().scopeId
  const key = `${scopeId}:${name}:${JSON.stringify(payload)}`
  const serial = ++sequence
  queries.set(key, serial)
  const result = await port().query(name, payload, scopeId)
  if (
    name !== 'session.get' &&
    (scopeId !== useSessionStore.getState().scopeId || queries.get(key) !== serial)
  ) {
    throw new RuntimeError('runtime.stale-response', '已忽略过期查询')
  }
  return result
}

export async function command<K extends RuntimeCommandName>(
  name: K,
  payload: RuntimeCommandPayload<K>
): Promise<RuntimeCommandResult<K>> {
  const scopeId = useSessionStore.getState().scopeId
  const result = await port().command(name, payload, scopeId)
  if (
    !/^(session\.|account\.|workspace\.)/.test(name) &&
    scopeId !== useSessionStore.getState().scopeId
  ) {
    throw new RuntimeError('runtime.stale-response', '已忽略过期命令结果')
  }
  return result
}

export function subscribe(listener: Parameters<RuntimePort['subscribe']>[0]): () => void {
  return port().subscribe(listener)
}

export function onFlush(handler: () => Promise<void>): () => void {
  return port().onFlush?.(handler) ?? (() => undefined)
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

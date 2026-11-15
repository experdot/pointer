/**
 * 内核客户端
 *
 * 展示层访问数据的唯一入口：查询、命令、事件订阅。
 * 组件与 store 不应直接访问 window.runtime。
 */

import { t } from '@renderer/i18n'
import type {
  RuntimeCommandName,
  RuntimeCommandPayload,
  RuntimeCommandResult,
  RuntimePort,
  RuntimeQueryName,
  RuntimeQueryPayload,
  RuntimeQueryResult
} from '@shared/contracts'
import { RuntimeError, isApplicationLocaleOperation } from '@shared/contracts'
import { useSessionStore } from '../stores/sessionStore'
import { formatError, type LocalizedMessage } from '@shared/i18n/message'

const queries = new Map<string, number>()
let sequence = 0
export function resetQueries(): void {
  queries.clear()
}

function port(): RuntimePort {
  const runtime = window.runtime
  if (!runtime) {
    throw new Error(t('errors.runtime.unavailable'))
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
  const result = await port().query(name, payload, scopeId).catch(rethrow)
  if (
    name !== 'session.get' &&
    !isApplicationLocaleOperation(name) &&
    (scopeId !== useSessionStore.getState().scopeId || queries.get(key) !== serial)
  ) {
    throw new RuntimeError('runtime.stale-response', t('errors.runtime.staleQuery'))
  }
  return result
}

export async function command<K extends RuntimeCommandName>(
  name: K,
  payload: RuntimeCommandPayload<K>
): Promise<RuntimeCommandResult<K>> {
  const scopeId = useSessionStore.getState().scopeId
  const result = await port().command(name, payload, scopeId).catch(rethrow)
  if (
    !/^(session\.|account\.|workspace\.)/.test(name) &&
    !isApplicationLocaleOperation(name) &&
    scopeId !== useSessionStore.getState().scopeId
  ) {
    throw new RuntimeError('runtime.stale-response', t('errors.runtime.staleCommand'))
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
  return formatError(error, t)
}

function rethrow(error: unknown): never {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    const failure = new RuntimeError(
      error.code,
      'localized' in error && error.localized
        ? (error.localized as LocalizedMessage)
        : error.message,
      'details' in error ? error.details : undefined
    )
    failure.message = errorMessage(failure)
    throw failure
  }
  throw error
}

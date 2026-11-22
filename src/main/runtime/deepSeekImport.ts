import { readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { RuntimeError } from '@shared/contracts'
import {
  DEEPSEEK_INDEX_FILENAME,
  parseDeepSeekIndex,
  parseDeepSeekV3Conversation,
  type ImportConversationSummary,
  type ImportedConversation
} from '@shared/domain'
import type { Translate } from '@shared/i18n'
import { formatError, LocalizedError, msg } from '@shared/i18n/message'
import { assertRegularPath, assertSafeId } from './pathSafety'

async function readDeepSeekFile<T>(
  root: string,
  fileName: string,
  t: Translate,
  parse: (data: unknown) => T
): Promise<T> {
  try {
    const path = join(root, fileName)
    await assertRegularPath(root, path)
    const text = await readFile(path, 'utf8')
    let data: unknown
    try {
      data = JSON.parse(text.replace(/^\uFEFF/, ''))
    } catch {
      throw new LocalizedError(msg('errors.import.invalidJson'))
    }
    return parse(data)
  } catch (error) {
    let reason: string
    if (error instanceof LocalizedError) {
      reason = formatError(error, t)
    } else {
      const code = error instanceof Error && 'code' in error ? error.code : undefined
      reason = t(
        code === 'ENOENT' || code === 'ENOTDIR'
          ? 'errors.import.fileMissing'
          : 'errors.import.fileUnreadable'
      )
    }
    throw new RuntimeError(
      'library.deepseek-file',
      msg('errors.import.deepSeekFile', {
        v0: fileName,
        v1: reason
      })
    )
  }
}

export function readDeepSeekIndex(
  indexPath: string,
  now: number,
  t: Translate
): Promise<ImportConversationSummary[]> {
  if (typeof indexPath !== 'string' || !isAbsolute(indexPath))
    throw new RuntimeError(
      'library.deepseek-local-index',
      msg('errors.import.deepSeekIndexLocalFile')
    )
  const name = basename(indexPath)
  if (name.toLowerCase() !== DEEPSEEK_INDEX_FILENAME)
    throw new RuntimeError('library.deepseek-index-name', msg('errors.import.deepSeekIndexName'))

  return readDeepSeekFile(dirname(indexPath), name, t, (data) => {
    const sessions = parseDeepSeekIndex(data, now, t)
    for (const session of sessions) assertSafeId(session.id)
    return sessions
  })
}

export function readDeepSeekSession(
  indexPath: string,
  id: string,
  now: number,
  t: Translate
): Promise<ImportedConversation> {
  return readDeepSeekFile(dirname(indexPath), `chat_sessions/${id}.json`, t, (data) => {
    const conversation = parseDeepSeekV3Conversation(data, now, t)
    if (conversation.id !== id)
      throw new LocalizedError(msg('errors.import.deepSeekConversationId'))
    return conversation
  })
}

/**
 * 命名规则
 *
 * 页面文件名与显示名称的唯一化规则集中于此，供内核在写盘前使用；
 * 展示层不再自行拼接文件名。
 */

import { nameKey } from './common'

const PAGE_FILE_EXTENSION = '.pointer.md'
export const MAX_FILE_BASE_LENGTH = 80

/** 新建页面与文件夹的默认名称（内核创建时使用，展示层据此判断"尚未改名"） */
export const DEFAULT_PAGE_NAME = '新对话'
export const DEFAULT_FOLDER_NAME = '新建文件夹'

/** 与 uniqueName 生成的唯一化后缀保持一致：默认名本身或"默认名 (n)" */
const DEFAULT_PAGE_NAME_PATTERN = new RegExp(`^${DEFAULT_PAGE_NAME}(?: \\(\\d+\\))?$`)

/** 页面是否仍是新建时的默认名（决定首条消息是否需要自动改名） */
export function isDefaultPageName(name: string): boolean {
  return DEFAULT_PAGE_NAME_PATTERN.test(name)
}

/** Windows 保留设备名 */
const RESERVED_BASE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** 文件系统非法字符（Windows 与 POSIX 的保守并集） */
// eslint-disable-next-line no-control-regex
const ILLEGAL_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

/** 将任意名称转换为可用于文件名的安全形式 */
export function sanitizeFileName(name: string): string {
  let base = name.replace(ILLEGAL_FILE_CHARS, ' ').replace(/\s+/g, ' ').trim()
  // Windows 不允许文件名以点或空格结尾
  base = base.replace(/[. ]+$/, '')
  if (base.length > MAX_FILE_BASE_LENGTH) {
    base = base.slice(0, MAX_FILE_BASE_LENGTH).trim()
  }
  if (!base) return 'untitled'
  if (RESERVED_BASE_NAMES.test(base)) return `_${base}`
  return base
}

/** 名称候选值：index 为 0 时返回原名，否则追加 " (n)" */
function nameCandidate(desired: string, index: number): string {
  return index === 0 ? desired : `${desired} (${index})`
}

/**
 * 在已占用名称集合中生成唯一的显示名称
 *
 * taken 中的元素应为 nameKey() 归一化后的结果。
 */
export function uniqueName(
  taken: ReadonlySet<string>,
  desired: string,
  maxAttempts = 1000
): string {
  for (let index = 0; index < maxAttempts; index++) {
    const candidate = nameCandidate(desired, index)
    if (!taken.has(nameKey(candidate))) return candidate
  }
  return `${desired} ${Date.now()}`
}

/**
 * 在已占用文件名集合中生成唯一的页面文件名（含扩展名）
 *
 * taken 中的元素应为 nameKey() 归一化后的结果。
 */
export function uniquePageFileName(
  taken: ReadonlySet<string>,
  pageName: string,
  maxAttempts = 1000
): string {
  const base = sanitizeFileName(pageName)

  for (let index = 0; index < maxAttempts; index++) {
    const fileName = `${nameCandidate(base, index)}${PAGE_FILE_EXTENSION}`
    if (!taken.has(nameKey(fileName))) return fileName
  }

  return `${base} ${Date.now()}${PAGE_FILE_EXTENSION}`
}

/** 判断文件名是否属于 Pointer 页面文件 */
export function isPageFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(PAGE_FILE_EXTENSION)
}

/** 去掉页面文件扩展名，得到基础名 */
export function stripPageFileExtension(fileName: string): string {
  return isPageFileName(fileName)
    ? fileName.slice(0, fileName.length - PAGE_FILE_EXTENSION.length)
    : fileName
}

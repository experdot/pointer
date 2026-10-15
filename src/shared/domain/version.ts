/**
 * 语义版本比较
 *
 * 只实现应用需要的部分：major.minor.patch 与预发布标识（如 2.0.0-preview.1）。
 * 预发布版本永远小于同号的正式版本；预发布之间按标识逐段比较，数字段按数值比较。
 * 构建元数据（+build）按 semver 忽略，不参与比较。
 */

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: Array<string | number>
}

function parseVersion(value: string): ParsedVersion | null {
  const trimmed = value.trim().replace(/^v/i, '')
  const match = trimmed.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  if (!match) return null

  const prerelease = (match[4] ?? '')
    .split('.')
    .filter((part) => part.length > 0)
    .map((part) => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : part))

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease
  }
}

/** remote 是否比 local 更新；任一版本无法解析时返回 false（宁可不提示） */
export function isNewerVersion(remote: string, local: string): boolean {
  const a = parseVersion(remote)
  const b = parseVersion(local)
  if (!a || !b) return false

  if (a.major !== b.major) return a.major > b.major
  if (a.minor !== b.minor) return a.minor > b.minor
  if (a.patch !== b.patch) return a.patch > b.patch

  // 正式版 > 预发布版
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return false
  if (a.prerelease.length === 0) return true
  if (b.prerelease.length === 0) return false

  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index++) {
    const left = a.prerelease[index]
    const right = b.prerelease[index]
    if (left === undefined) return false
    if (right === undefined) return true
    if (left === right) continue

    const leftIsNumber = typeof left === 'number'
    const rightIsNumber = typeof right === 'number'
    if (leftIsNumber && rightIsNumber) return left > right
    if (leftIsNumber) return false
    if (rightIsNumber) return true
    return left > right
  }

  return false
}

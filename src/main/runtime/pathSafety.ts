import { lstat, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { RuntimeError } from '@shared/contracts'

export function assertSafeId(id: string): void {
  if (
    typeof id !== 'string' ||
    !id ||
    id === '.' ||
    id === '..' ||
    // eslint-disable-next-line no-control-regex
    /[\\/:<>"|?*\x00-\x1f]/.test(id) ||
    /[. ]$/.test(id) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(id)
  )
    throw new RuntimeError('runtime.invalid-id', '非法实体标识')
}

export function assertWithin(root: string, target: string): void {
  const part = relative(resolve(root), resolve(target))
  if (!part || part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) {
    throw new RuntimeError('attachment.invalid-path', '路径超出允许的目录')
  }
}

/** 拒绝路径中任一符号链接或 junction，缺失的最终文件可供导入创建。 */
export async function assertRegularPath(
  root: string,
  target: string,
  missing = false
): Promise<void> {
  assertWithin(root, target)
  const realRoot = await realpath(root)
  const parts = relative(root, target).split(sep)
  let current = root
  for (let index = 0; index < parts.length; index++) {
    current = resolve(current, parts[index])
    let info
    try {
      info = await lstat(current)
    } catch (error) {
      if (
        missing &&
        index === parts.length - 1 &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      )
        return
      throw error
    }
    if (
      info.isSymbolicLink() ||
      (index === parts.length - 1 ? !info.isFile() : !info.isDirectory())
    ) {
      throw new RuntimeError('attachment.invalid-path', '路径不是允许的普通文件')
    }
    assertWithin(realRoot, await realpath(current))
  }
}

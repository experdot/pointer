import { app } from 'electron'
import * as path from 'path'

export interface WorkspaceAccessContext {
  currentWorkspacePath: string | null
  approvedWorkspacePaths: string[]
}

const approvedWorkspaceRoots = new Set<string>()
let currentWorkspaceRoot: string | null = null

function normalizeRoot(rootPath: string): string {
  return path.resolve(rootPath)
}

export function syncWorkspaceAccessContext(context: WorkspaceAccessContext): void {
  approvedWorkspaceRoots.clear()

  currentWorkspaceRoot = context.currentWorkspacePath
    ? normalizeRoot(context.currentWorkspacePath)
    : null

  for (const workspacePath of context.approvedWorkspacePaths) {
    approvedWorkspaceRoots.add(normalizeRoot(workspacePath))
  }

  if (currentWorkspaceRoot) {
    approvedWorkspaceRoots.add(currentWorkspaceRoot)
  }
}

export function approveWorkspacePath(workspacePath: string): void {
  approvedWorkspaceRoots.add(normalizeRoot(workspacePath))
}

export function getCurrentWorkspacePath(): string | null {
  return currentWorkspaceRoot
}

export function getAllowedFileSystemRoots(allowCustomPath = false): string[] {
  const roots = new Set<string>([normalizeRoot(app.getPath('userData'))])

  if (allowCustomPath) {
    for (const workspaceRoot of approvedWorkspaceRoots) {
      roots.add(workspaceRoot)
    }
  }

  if (currentWorkspaceRoot) {
    roots.add(currentWorkspaceRoot)
  }

  return Array.from(roots)
}

export function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedRoot = path.resolve(rootPath)
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep)
}

export function resolveRelativePathWithinRoot(rootPath: string, relativePath: string): string {
  const normalizedRelativePath = path.normalize(relativePath)

  if (
    path.isAbsolute(normalizedRelativePath) ||
    normalizedRelativePath === '..' ||
    normalizedRelativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`Invalid relative path: ${relativePath}`)
  }

  const resolvedPath = path.resolve(rootPath, normalizedRelativePath)
  if (!isPathWithinRoot(resolvedPath, rootPath)) {
    throw new Error(`Path escapes root: ${relativePath}`)
  }

  return resolvedPath
}

export function getCurrentAttachmentsDirectory(): string {
  if (!currentWorkspaceRoot) {
    throw new Error('Current workspace path is not set')
  }

  return path.join(currentWorkspaceRoot, '.pointer', 'attachments')
}

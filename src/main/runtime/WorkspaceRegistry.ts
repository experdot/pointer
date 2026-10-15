/**
 * 工作区注册表（每个账户一份 workspaces.json）与工作区身份文件
 *
 * 工作区身份（.pointer/workspace.json）用于识别目录是否已属于某个账户，
 * 避免两个账户同时接管同一目录。
 */

import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import type {
  Workspace,
  WorkspacePathValidation,
  WorkspaceRepairIssue,
  WorkspaceSummary
} from '@shared/domain'
import { createWorkspace, toWorkspaceSummary } from '@shared/domain'
import { RuntimeError } from '@shared/contracts'
import type { PathResolver } from './paths'
import { ensureDir, isDirectory, pathExists, readJson, removePath, writeJsonAtomic } from './fsx'

interface WorkspacesFile {
  currentWorkspaceId: string | null
  workspaces: Workspace[]
}

interface WorkspaceIdentity {
  version: number
  id: string
  accountId: string
  name: string
  createdAt: number
  updatedAt?: number
}

const IDENTITY_VERSION = 1

export class WorkspaceRegistry {
  private workspaces: Workspace[] = []
  private currentWorkspaceId: string | null = null

  constructor(
    private readonly paths: PathResolver,
    private accountId: string
  ) {}

  get account(): string {
    return this.accountId
  }

  async load(accountId: string): Promise<void> {
    this.accountId = accountId
    const file = await readJson<WorkspacesFile>(this.paths.workspacesFile(accountId))
    this.workspaces = file?.workspaces ?? []

    // 指针失效（如工作区被外部移除）时回退到列表中的第一个工作区
    this.currentWorkspaceId =
      file?.currentWorkspaceId &&
      this.workspaces.some((workspace) => workspace.id === file.currentWorkspaceId)
        ? file.currentWorkspaceId
        : (this.workspaces[0]?.id ?? null)
  }

  list(): WorkspaceSummary[] {
    return this.workspaces.map(toWorkspaceSummary)
  }

  getById(workspaceId: string): Workspace | undefined {
    const workspace = this.workspaces.find((item) => item.id === workspaceId)
    return workspace ? { ...workspace } : undefined
  }

  getCurrentId(): string | null {
    return this.currentWorkspaceId
  }

  getCurrent(): Workspace | null {
    return this.currentWorkspaceId ? (this.getById(this.currentWorkspaceId) ?? null) : null
  }

  async setCurrent(workspaceId: string): Promise<Workspace> {
    const workspace = this.getById(workspaceId)
    if (!workspace) throw new RuntimeError('workspace.not-found', `工作区不存在：${workspaceId}`)
    this.currentWorkspaceId = workspaceId
    await this.persist()
    return workspace
  }

  /** 确保账户至少有一个可用的默认工作区 */
  async ensureDefault(at: number): Promise<Workspace> {
    const existing = this.getCurrent()
    if (existing && (await isDirectory(existing.path))) return existing

    const dirPath = this.paths.defaultWorkspacePath(this.accountId)
    await ensureDir(dirPath)

    const registered = this.workspaces.find((item) => item.path === dirPath)
    if (registered) {
      this.currentWorkspaceId = registered.id
      await this.ensureIdentity(registered)
      await this.persist()
      return registered
    }

    const workspace = createWorkspace(
      {
        id: randomUUID(),
        accountId: this.accountId,
        name: '默认工作区',
        type: 'default',
        path: dirPath
      },
      at
    )

    this.workspaces = [...this.workspaces, workspace]
    this.currentWorkspaceId = workspace.id
    await this.ensureIdentity(workspace)
    await this.persist()
    return workspace
  }

  async create(input: { name: string; dirPath: string }, at: number): Promise<Workspace> {
    const dirPath = input.dirPath
    await ensureDir(dirPath)

    const validation = await this.validatePath(dirPath)
    if (validation.lockedByAccountId && validation.lockedByAccountId !== this.accountId) {
      throw new RuntimeError('workspace.locked', '该目录已被其他账户使用')
    }

    const existing = this.workspaces.find((item) => item.path === dirPath)
    if (existing) {
      this.currentWorkspaceId = existing.id
      await this.persist()
      return existing
    }

    const workspace = createWorkspace(
      {
        id: validation.workspaceId ?? randomUUID(),
        accountId: this.accountId,
        name: input.name.trim() || basename(dirPath),
        type: 'custom',
        path: dirPath
      },
      at
    )

    this.workspaces = [...this.workspaces, workspace]
    this.currentWorkspaceId = workspace.id
    await this.ensureIdentity(workspace)
    await this.persist()
    return workspace
  }

  async rename(workspaceId: string, name: string, at: number): Promise<Workspace> {
    const workspace = this.getById(workspaceId)
    if (!workspace) throw new RuntimeError('workspace.not-found', `工作区不存在：${workspaceId}`)

    const updated: Workspace = { ...workspace, name: name.trim() || workspace.name, updatedAt: at }
    this.workspaces = this.workspaces.map((item) => (item.id === workspaceId ? updated : item))
    await this.ensureIdentity(updated)
    await this.persist()
    return updated
  }

  /** 注销工作区；默认工作区连同磁盘目录一起删除 */
  async remove(workspaceId: string): Promise<void> {
    const workspace = this.getById(workspaceId)
    if (!workspace) throw new RuntimeError('workspace.not-found', `工作区不存在：${workspaceId}`)
    if (this.workspaces.length <= 1) {
      throw new RuntimeError('workspace.last-workspace', '至少需要保留一个工作区')
    }

    this.workspaces = this.workspaces.filter((item) => item.id !== workspaceId)
    if (this.currentWorkspaceId === workspaceId) {
      this.currentWorkspaceId = this.workspaces[0]?.id ?? null
    }
    await this.persist()

    if (workspace.type === 'default') {
      await removePath(workspace.path, true)
    }
  }

  async validatePath(dirPath: string): Promise<WorkspacePathValidation> {
    if (!(await isDirectory(dirPath))) {
      return { valid: false, isWorkspace: false, error: '目录不存在或不是文件夹' }
    }

    const identityPath = this.paths.workspaceConfigFile(dirPath)
    const identity = await readJson<WorkspaceIdentity>(identityPath)
    const issues: WorkspaceRepairIssue[] = []

    if (!identity?.id || !identity.accountId) {
      issues.push('missing-config')
    } else if (identity.accountId !== this.accountId) {
      return {
        valid: false,
        isWorkspace: true,
        workspaceId: identity.id,
        lockedByAccountId: identity.accountId,
        error: '该工作区属于其他账户'
      }
    }

    if (!(await pathExists(this.paths.pointerDir(dirPath)))) issues.push('missing-pointer-dir')
    if (!(await pathExists(this.paths.attachmentsDir(dirPath)))) {
      issues.push('missing-attachments-dir')
    }

    return {
      valid: true,
      isWorkspace: Boolean(identity?.id),
      workspaceId: identity?.id,
      repairable: issues.length > 0,
      repairIssues: issues.length > 0 ? issues : undefined
    }
  }

  /** 补齐缺失的目录与身份文件 */
  async repairPath(dirPath: string, at: number): Promise<WorkspacePathValidation> {
    await ensureDir(this.paths.pointerDir(dirPath))
    await ensureDir(this.paths.attachmentsDir(dirPath))
    await ensureDir(this.paths.queuesDir(dirPath))

    const registered = this.workspaces.find((item) => item.path === dirPath)
    const identity = await readJson<WorkspaceIdentity>(this.paths.workspaceConfigFile(dirPath))

    if (!identity?.id) {
      const next: WorkspaceIdentity = {
        version: IDENTITY_VERSION,
        id: registered?.id ?? randomUUID(),
        accountId: this.accountId,
        name: registered?.name ?? basename(dirPath),
        createdAt: registered?.createdAt ?? at
      }
      await writeJsonAtomic(this.paths.workspaceConfigFile(dirPath), next)
    }

    return this.validatePath(dirPath)
  }

  private async ensureIdentity(workspace: Workspace): Promise<void> {
    await ensureDir(this.paths.pointerDir(workspace.path))
    const identity: WorkspaceIdentity = {
      version: IDENTITY_VERSION,
      id: workspace.id,
      accountId: workspace.accountId,
      name: workspace.name,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    }
    await writeJsonAtomic(this.paths.workspaceConfigFile(workspace.path), identity)
  }

  private async persist(): Promise<void> {
    await writeJsonAtomic(this.paths.workspacesFile(this.accountId), {
      currentWorkspaceId: this.currentWorkspaceId,
      workspaces: this.workspaces
    } satisfies WorkspacesFile)
  }
}

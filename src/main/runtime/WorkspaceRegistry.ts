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
import {
  ensureDir,
  isDirectory,
  pathExists,
  readJson,
  readText,
  removePath,
  movePath,
  writeJsonAtomic,
  writeTextAtomic
} from './fsx'

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
    await this.persist(workspaceId)
    this.currentWorkspaceId = workspaceId
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
      await this.commitWorkspace(registered, this.workspaces, registered.id)
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

    await this.commitWorkspace(workspace, [...this.workspaces, workspace], workspace.id)
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

    await this.commitWorkspace(workspace, [...this.workspaces, workspace])
    return workspace
  }

  async rename(workspaceId: string, name: string, at: number): Promise<Workspace> {
    const workspace = this.getById(workspaceId)
    if (!workspace) throw new RuntimeError('workspace.not-found', `工作区不存在：${workspaceId}`)

    const updated: Workspace = { ...workspace, name: name.trim() || workspace.name, updatedAt: at }
    await this.commitWorkspace(
      updated,
      this.workspaces.map((item) => (item.id === workspaceId ? updated : item))
    )
    return updated
  }

  /** 注销工作区；默认工作区连同磁盘目录一起删除 */
  async remove(workspaceId: string): Promise<void> {
    const workspace = this.getById(workspaceId)
    if (!workspace) throw new RuntimeError('workspace.not-found', `工作区不存在：${workspaceId}`)
    if (this.workspaces.length <= 1) {
      throw new RuntimeError('workspace.last-workspace', '至少需要保留一个工作区')
    }

    const workspaces = this.workspaces.filter((item) => item.id !== workspaceId)
    const currentWorkspaceId =
      this.currentWorkspaceId === workspaceId
        ? (workspaces[0]?.id ?? null)
        : this.currentWorkspaceId
    // 先提交注销，再清理默认目录。清理失败保留残留文件，不恢复已提交的注册记录。
    const retired =
      workspace.type === 'default' ? `${workspace.path}.deleted-${randomUUID()}` : null
    await this.persist(currentWorkspaceId, workspaces)
    this.workspaces = workspaces
    this.currentWorkspaceId = currentWorkspaceId
    if (retired) {
      try {
        await movePath(workspace.path, retired)
        await removePath(retired, true)
      } catch (error) {
        console.warn('[runtime] 已注销工作区，待清理目录：', retired, error)
      }
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

  private async commitWorkspace(
    workspace: Workspace,
    workspaces: Workspace[],
    currentWorkspaceId = this.currentWorkspaceId
  ): Promise<void> {
    const identityPath = this.paths.workspaceConfigFile(workspace.path)
    const previous = await readText(identityPath)
    await this.ensureIdentity(workspace)
    try {
      await this.persist(currentWorkspaceId, workspaces)
    } catch (error) {
      try {
        if (previous === null) await removePath(identityPath)
        else await writeTextAtomic(identityPath, previous)
      } catch (failure) {
        throw new AggregateError([error, failure], '注册失败且工作区身份恢复失败')
      }
      throw error
    }
    this.workspaces = workspaces
    this.currentWorkspaceId = currentWorkspaceId
  }

  private async persist(
    currentWorkspaceId = this.currentWorkspaceId,
    workspaces = this.workspaces
  ): Promise<void> {
    await writeJsonAtomic(this.paths.workspacesFile(this.accountId), {
      currentWorkspaceId,
      workspaces
    } satisfies WorkspacesFile)
  }
}

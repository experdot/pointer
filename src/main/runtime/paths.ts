/**
 * 内核层路径解析
 *
 * 所有绝对路径只在此处产生，渲染进程永远看不到它们。
 *
 * 磁盘布局：
 *
 *   <appData>/
 *     accounts.json                账户目录
 *     session.json                 上次使用的账户/工作区
 *     accounts/<accountId>/
 *       workspaces.json            该账户的工作区列表
 *       settings.json              账户级设置
 *       secrets.json               历史版本的加密 API Key（仅供一次性迁移读取）
 *     workspaces/<accountId>/default/   默认工作区
 *
 *   <workspace>/
 *     <文件夹>/<页面>.pointer.md   页面文件（人类可读，可纳入 git）
 *     .pointer/                    内核私有数据
 *       workspace.json             工作区身份
 *       folders.json               文件夹元数据（稳定 id 与排序）
 *       view-state.json            展示层状态（不透明文档）
 *       index.db                   SQLite 索引（可重建）
 *       attachments/               附件
 *       queues/<pageId>.json       消息队列
 */

import { join } from 'node:path'

const POINTER_DIR = '.pointer'

export class PathResolver {
  constructor(readonly appDataPath: string) {}

  get accountsFile(): string {
    return join(this.appDataPath, 'accounts.json')
  }

  get sessionFile(): string {
    return join(this.appDataPath, 'session.json')
  }

  accountDir(accountId: string): string {
    return join(this.appDataPath, 'accounts', accountId)
  }

  workspacesFile(accountId: string): string {
    return join(this.accountDir(accountId), 'workspaces.json')
  }

  settingsFile(accountId: string): string {
    return join(this.accountDir(accountId), 'settings.json')
  }

  secretsFile(accountId: string): string {
    return join(this.accountDir(accountId), 'secrets.json')
  }

  defaultWorkspacePath(accountId: string): string {
    return join(this.appDataPath, 'workspaces', accountId, 'default')
  }

  pointerDir(workspacePath: string): string {
    return join(workspacePath, POINTER_DIR)
  }

  workspaceConfigFile(workspacePath: string): string {
    return join(this.pointerDir(workspacePath), 'workspace.json')
  }

  foldersFile(workspacePath: string): string {
    return join(this.pointerDir(workspacePath), 'folders.json')
  }

  viewStateFile(workspacePath: string): string {
    return join(this.pointerDir(workspacePath), 'view-state.json')
  }

  indexFile(workspacePath: string): string {
    return join(this.pointerDir(workspacePath), 'index.db')
  }

  attachmentsDir(workspacePath: string): string {
    return join(this.pointerDir(workspacePath), 'attachments')
  }

  queuesDir(workspacePath: string): string {
    return join(this.pointerDir(workspacePath), 'queues')
  }

  queueFile(workspacePath: string, pageId: string): string {
    return join(this.queuesDir(workspacePath), `${pageId}.json`)
  }

  /** 页面文件位于工作区根目录，文件夹层级映射为真实目录 */
  pageFile(workspacePath: string, folderSegments: readonly string[], fileName: string): string {
    return join(workspacePath, ...folderSegments, fileName)
  }

  /** 附件的相对路径（相对工作区根目录），用于写入领域模型 */
  attachmentRelativePath(fileName: string): string {
    return `${POINTER_DIR}/attachments/${fileName}`
  }
}

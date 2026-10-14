/**
 * 展示层状态存储
 *
 * 内核把 ViewState 当作不透明文档：只负责持久化，不解释字段含义。
 */

import type { ViewState } from '../../shared/contracts'
import { defaultViewState } from '../../shared/contracts'
import type { PathResolver } from './paths'
import { readJson, writeJsonAtomic } from './fsx'

export class ViewStateStore {
  private state: ViewState = defaultViewState()

  constructor(
    private readonly paths: PathResolver,
    private readonly workspacePath: string
  ) {}

  async load(): Promise<void> {
    const file = await readJson<Partial<ViewState>>(this.paths.viewStateFile(this.workspacePath))
    this.state = { ...defaultViewState(), ...(file ?? {}) }
  }

  get(): ViewState {
    return {
      ...this.state,
      tabs: this.state.tabs.map((tab) => ({ ...tab })),
      history: this.state.history.map((entry) => ({ ...entry })),
      layout: { ...this.state.layout },
      expandedFolderIds: [...this.state.expandedFolderIds],
      expandedConfigFolderIds: [...this.state.expandedConfigFolderIds]
    }
  }

  async replace(state: ViewState): Promise<void> {
    this.state = { ...state }
    await writeJsonAtomic(this.paths.viewStateFile(this.workspacePath), this.state)
  }
}

# 迁移一致性 Review

> 状态：**R1–R3、R6–R13 已修复并验证**；R4/R5 属于历史数据形态问题，按决定不做兼容迁移
> 原则：用户侧的功能与表现应与迁移前一致；迁移只应改变内部架构，不应改变外部行为。
> 对照基准：迁移前的 `main` 分支实现（可用 `git show HEAD:<path>` 取出对比）。

## 修复状态

| #   | 状态             | 修复方式                                                                    | 验证                                                                 |
| --- | ---------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| R1  | 已修复           | 页面树变化时由镜像关闭失效页签并清理会话/队列缓存                           | 镜像测试：删除页面后页签关闭、缓存清空                               |
| R2  | 已修复           | 元数据变更立即写回页面文件（`replacePageMetadata`），重扫不再回滚           | 冒烟：星标+改名写入文件，重开工作区后保持不变                        |
| R3  | 已修复           | `openPage` 未命中镜像时先刷新页面树，再按 `dataId` 复用页签并预加载消息     | 镜像测试：镜像未刷新时仍能打开，且不重复开页签                       |
| R4  | 不修（历史数据） | 旧明文密钥不再兼容；清空历史数据后在新界面重新录入即可                      | —                                                                    |
| R5  | 不修（历史数据） | 旧设置条目缺 `kind`；清空历史数据后新建条目自带 `kind`                      | —                                                                    |
| R6  | 已修复           | 标题/话题/智能分段/会话标题失败时 toast + console 输出原因                  | 代码检查（失败不再被吞）                                             |
| R7  | 已修复           | 镜像在页面树变化时同步页签标题（一次写入）                                  | 镜像测试：改名后页签标题跟随                                         |
| R8  | 已修复           | 单个文件夹删除恢复为级联；批量删除保持"提升到根目录"                        | 与 `git show HEAD` 的旧语义逐条对齐                                  |
| R9  | 已修复           | 新增 `conversation.updateMessages` 批量命令                                 | 镜像测试：折叠 3 条只发 1 次命令；领域测试                           |
| R10 | 已修复           | `switchBranchToMessage`（叶子下沉 + 记录选中）；删除后回退到前一个兄弟分支  | 领域测试 12 条（含边界）                                             |
| R11 | 已修复           | 更新检查加语义版本比较，命令返回结果，"已是最新版本"提示恢复                | 领域测试：版本比较；`app.checkUpdate` 返回 `{available,version}`     |
| R12 | 已修复           | 页签按 `dataId` 复用、打开前预加载、删除后清理缓存、恢复移动冲突弹窗        | 镜像测试 + 代码检查                                                  |
| R13 | 已修复           | 导入按层级/顺序创建并保留星标                                               | 代码检查（`page.create` 支持 `starred`）                             |
| R14 | 已修复           | 切换工作区时先恢复目标页签再对齐页面树，避免旧页签写进新工作区的 view-state | 镜像测试：切换后仅保留目标工作区页签，且写回的 view-state 不含旧页签 |

> 回归保护：`pnpm test`（106 个用例，含上述新增断言）、`pnpm smoke:kernel`（20 项，含"星标+改名落盘且重扫不回滚"）。

## 第二轮：账户 / 工作区 / 设置面板

用户反馈的三个问题都落在这条链路上，逐条定位后还挖出几个同源问题：

| #   | 状态   | 问题                                                                                          | 修复                                                                      | 验证                                               |
| --- | ------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| R15 | 已修复 | 切换/新建账户后头像、名称、当前工作区不更新（镜像没刷新 accounts，且用旧 state 拼当前工作区） | `refreshWorkspaceScope` 一并刷新账户列表，当前账户/工作区改由会话快照推导 | 镜像测试：切换账户后列表与 currentAccountId 都更新 |
| R16 | 已修复 | 新建 LLM 配置无法保存：写入被校验拒绝，随后密钥回推的权威状态覆盖了正在编辑的节点             | `SettingsStore.replace` 不再拒绝半填文档（与迁移前一致，仅记录诊断）      | 冒烟：空 baseUrl/modelName 的配置也能保存          |
| R17 | 已修复 | "配置 LLM"入口只打开设置标签页，不跳转到 LLM 内页                                             | pending 内页改为 store 驱动，挂载与后续请求都生效                         | 镜像测试：请求→消费→不重复消费                     |
| R18 | 已修复 | 切换账户/工作区时不停止进行中的生成，收尾会写进新上下文导致回复丢失                           | 切换前 `ChatEngine.abortAll()`：中止全部生成并等待落盘                    | 代码路径（与迁移前 `stopActiveWork` 对齐）         |
| R19 | 已修复 | 登出清空本地账户状态（迁移前是切回默认账户）；删除账户缺少默认/当前账户保护                   | `logout` 切回第一个账户；`removeAccount` 恢复两道保护                     | 代码检查（与 `git show HEAD` 的旧实现逐条对齐）    |
| R20 | 已修复 | 非当前账户改名/换头像不回推，列表显示旧值                                                     | 新增 `accounts.changed` 事件                                              | 事件链路                                           |
| R21 | 已修复 | 切换过程中按钮没有加载态（我引入的 `switching = false` 死值）                                 | 恢复真实 `useState` 状态                                                  | 代码检查                                           |

> 说明：R17 在迁移前是同样的实现（`SettingsEditor` 只在挂载时消费 `pendingSettingsTab`），属于既有缺陷而非迁移回归；因为影响日常使用，仍然一并修掉。

### R22 设置面板输入卡顿 / 输入法串字

**现象**：在设置里新建 LLM/模型配置后输入名称、API 地址、系统提示词时明显卡顿；
用中文输入法打字，拼音与英文会同时留在输入框里。

**根因**：迁移前设置写入走 300ms 去抖队列（内存立即更新、落盘延后）；迁移后每个按键都直接
"命令 → 内核原子写（含 fsync） → 事件回推"，输入期间大量 IPC 与磁盘写入导致卡顿；
而回推的文档会在组词过程中把输入框的值改回旧内容，于是中英文都留在框里。

**修复**：

1. `settingsStore` 恢复去抖（300ms 合并落盘），新增 `flush()`，在切换账户/工作区与窗口关闭前调用，
   避免把上一个账户的待写内容写到新账户。
2. 新增 `useDraftField`：文本字段在聚焦/组词期间只用自己的本地值，外部回推只在未编辑时同步；
   组词结束后补一次提交（部分浏览器不再触发 change）。
3. 应用于 LLM 配置的名称 / API 地址 / 模型名称，以及模型配置的名称 / 系统提示词。

**验证**：镜像测试断言"连续两次修改只落盘一次、`flush` 立即提交"；输入法手感需要你实测确认。

### R23 新建对话落到列表末尾（应为最前面）

**现象**：新建对话出现在列表末尾，而迁移前是出现在最前面（或紧随当前会话）。

**根因**：旧 `prepareInsertPosition` 有两条我漏掉的分支：

1. 没有参照项时 `order = 0` **并把同级整体下移一位** → 新内容在最前面；
2. 没有参照项时，它还会拿**当前激活页签对应的会话**当参照 → 新内容紧随当前会话。

我实现成了"没有参照就追加到末尾"，于是新建的对话跑到列表最后。

**修复**：

- 内核 `applyInsertPosition` 按旧语义分三种情况：给了参照项 → 插到它之后；只给父文件夹 → 追加到文件夹末尾；
  两者都没有 → **插到最前面**（同级下移）。
- 渲染层 `pagesService.createPage/createFolder` 在未指定参照时回落到"当前激活会话"，与旧实现一致。
- 数据恢复导入改为按父文件夹串联 `afterNodeId`，避免"无参照即置顶"打乱导入顺序。

**验证**：冒烟新增断言"无参照时新建插到最前面（根二 | 根一）"；镜像测试断言未指定参照时以当前会话为基准。

**现在的落位规则**（与迁移前逐条对齐）：

| 入口                                        | 行为                   |
| ------------------------------------------- | ---------------------- |
| 资源管理器工具栏，选中某条会话/文件夹       | 插到该节点的同级之后   |
| 资源管理器工具栏，未选中                    | 插到当前打开的会话之后 |
| 欢迎页、标签栏「+」、Ctrl+N（无打开会话时） | 插到根目录最前面       |
| 右键「在文件夹中新建」                      | 追加到该文件夹末尾     |
| 数据恢复导入                                | 按备份顺序串联插入     |

## 结论摘要

| #   | 严重度 | 问题                                                              | 现象                                                 |
| --- | ------ | ----------------------------------------------------------------- | ---------------------------------------------------- |
| R1  | 功能   | 删除对话不关页签                                                  | 删除后残留一个空页签（显示"页面不存在"），需手工关闭 |
| R2  | 数据   | 页面元数据（星标/名称/顺序/父文件夹）不落盘，重扫时被磁盘状态覆盖 | 加星后改名，星标消失；改名/拖拽顺序可能回滚          |
| R3  | 功能   | 新建对话不打开页签                                                | 树节点出现但右侧没有页签                             |
| R4  | 功能   | legacy API Key 未迁移到 safeStorage                               | 4 个配置里 3 个不可用（聊天/生成标题都报缺少密钥）   |
| R5  | 表现   | 设置树把配置项渲染成文件夹图标                                    | LLM/模型配置节点显示文件夹图标且可展开               |
| R6  | 表现   | 生成标题/话题/智能分段失败时完全静默                              | "调用了模型但没有应用"，控制台也没有任何提示         |
| R7  | 功能   | 重命名不同步页签标题                                              | 改名后页签仍是旧名字                                 |
| R8  | 功能   | 「删除文件夹」语义反转且文案不符                                  | 提示"将删除文件夹内所有项目"，实际把内容提升到根目录 |
| R9  | 性能   | 「折叠全部/展开全部」对每条消息发一次命令                         | 长会话卡顿、N 次整文件写与重新拉取                   |
| R10 | 功能   | 分支切换不再同步 `selectedMessageId`；删除消息后落点变化          | 切换分支后不定位；删除后落点与旧行为不同             |
| R11 | 表现   | 更新缺少版本号比较，且丢失"已是最新版本"反馈                      | 远程版本低于本地也提示可升级；检查完无反馈           |
| R12 | 一致性 | 标签页 id 约定不统一；重名冲突弹窗成死代码                        | 同页面可能出现两个页签；冲突对话框永不触发           |
| R13 | 功能   | 数据恢复导入时页面/文件夹的顺序与星标丢失                         | 导入后顺序乱、星标没了                               |

## R1 删除对话不关页签

**证据**

- 旧 `pagesService` 的 `deletePage / deletePages / deleteFolder / clearFolder` 都会关闭对应页签、evict 消息缓存、移除队列记录（`git show HEAD:src/renderer/src/services/pagesService.ts`，行 134-180、300-360）。
- 迁移后的 `src/renderer/src/services/pagesService.ts` 只发命令，不再处理页签。
- `EditorArea` 的 `cleanupInvalidTabs()` 仅在 `tabs.length` 变化时触发（`src/renderer/src/components/layout/EditorArea/index.tsx:22-24`），删除页面不改变页签数量。
- `ChatEditor` 已有 `if (!page)` 兜底（渲染"页面不存在"），因此不会崩溃，但页签会一直留着，与迁移前"删除即关页签"不一致。

**根因**：页签生命周期职责在迁移中丢失（旧 `pagesService` 删除时关闭页签）。

**修复**：镜像在 `tree.changed` 到达时关闭 `dataId` 已不在页面树中的 chat 页签，并清理会话/队列缓存；这样外部删除页面文件时也一并覆盖。

## R2 页面元数据不落盘 + 重扫回滚

**证据**

- `WorkspaceStore` 中只有 `writeConversation` 调用 `writeTextAtomic` 写页面文件；`updatePage / movePage / applyInsertAfter` 只改内存（`src/main/runtime/WorkspaceStore.ts`）。
- 页面文件里的 `<pointer-page>` 块（name/starred/order/parentFolderId）只在写会话时才会刷新。
- `detectExternalChanges()` 在"没有页面 mtime 变化"时**无条件**调用 `scanFromDisk()`（`WorkspaceStore.ts:400-418`），而 `scanFromDisk()` 用文件里的元数据整体替换 `this.pages`。
- 触发链条：加星（仅内存）→ 随后改名/拖动触发 `applyLayout()` 移动文件 → 目录 mtime 变化 → `fs.watch` → 600ms 后 `checkExternalChanges` → 重扫 → 星标（文件里没有 `<starred>`）被抹掉；因为 `structureChanged` 为 false，不会发事件，界面要到下一个 `tree.changed` 才体现。
- 同类受影响：改名（文件里仍是旧名）、拖拽顺序（文件里仍是旧 order，重扫后 `applyLayout` 会按旧 order 把文件移回去）、`chat.generateSessionTitle` 生成的会话标题。

**建议**：元数据变更后立即把页面块写回文件（或在内存里记录"待写回"，由 `applyLayout` 一并提交）；`scanFromDisk` 不得覆盖比文件更新的内存元数据；两条都要有测试。

## R3 新建对话不打开页签

**证据**

- `pagesService.openPage()` 从**镜像**读取页面：`usePagesStore.getState().getById(pageId)`，查不到就 `return`。
- 镜像要等内核的 `tree.changed` 事件才更新，而 `createPage` 命令返回时事件尚未处理 → 必然查不到。
- 旧实现的 store 是乐观写入（`pagesStore.create` 先写内存），因此没有这个问题。
- 受影响入口：资源管理器工具栏「新建对话」、「在文件夹中新建」、欢迎页「新建对话」、标签栏「+」（`tabTypeRegistrations.tsx:23`、`Explorer.tsx:100-115`、`Tabs/index.tsx:200`）。
- 补充：全局快捷键 `Ctrl+N`（`shortcutService.ts:52-56` 的 `new-chat`）也走同一条路径。

**建议**：`openPage` 接受"已知页面对象"或改为在 `tree.changed` 里兜底打开待打开页签；也可让创建命令的返回结果直接用于开页签。

## R4 legacy API Key 未迁移（按决定不修）

**证据**（对真实账户数据只读检查）

```
REAL_DEFAULT_LLM 2c876fc4-...（deepseek-flash）
REAL_CONFIGS [{"name":"deepseek-flash","hasApiKey":true,"plainApiKeyField":true,"keyReadable":true},
              {"name":"google/gemini-2.5-flash","hasApiKey":false,"plainApiKeyField":true,"keyReadable":false},
              {"name":"google/gemini-2.5-pro-preview","hasApiKey":false,...},
              {"name":"anthropic/claude-opus-4.6","hasApiKey":false,...}]
```

- 旧实现把 `apiKey` 明文存在 `settings.json`；新内核只从 `secrets.json`（safeStorage）读取，且 `SettingsStore.replace()` 不会迁移这些明文密钥。
- 结果：除 deepseek 外，另外 3 个配置在界面上显示"未配置密钥"，实际一旦被选作对话或生成模型就会以 `ai.no-api-key` 失败。
- 附带安全问题：`settings.json` 中的明文 `apiKey` 字段仍被原样保留（`normalizeSettings` 不做字段清洗）。

**决定**：不实现历史数据迁移——清空历史数据后在新界面重新录入密钥即可。需要注意：在清空之前，选中没有密钥的配置会失败，失败原因现在会通过 R6 的提示暴露出来。

> 后续状态（2026-10-14，`1417229`）：密钥存储已回退为"明文随配置保存在 `settings.json`"，与迁移前一致，
> 因此上面这条"不修"的决定不再适用——旧配置里的明文 `apiKey` 重新可用，不需要清空历史数据重录。
> 若将来重新引入 `safeStorage`，需先定义旧明文密钥的迁移路径与 `hasApiKey` 的降级行为，见
> `docs/architecture.md` §4.3。

## R5 设置树图标错误（按决定不修）

**证据**

- `ConfigTree` 依赖 `isItem` 区分条目与文件夹，而面板传入的是 `isItem = (item) => item.kind === 'item'`（`LLMConfigPanel.tsx:40`、`ModelConfigPanel.tsx:31`）。
- 真实 `settings.json` 里的条目是旧结构的 `"type": "item"`，**没有 `kind` 字段**（探针输出 `kind: "(missing)"`）→ `isItem` 恒为 false → 条目走文件夹分支（文件夹图标、可展开）。

**决定**：不做历史数据归一化。清空历史数据后，新建的配置条目都会带上 `kind`（`settingsService` 已写入），图标即恢复正常。

## R6 生成类操作失败被静默吞掉

**证据**

- 旧实现会打印原因：`console.error('Failed to generate title:', result.error)`、`console.error('Failed to generate topic:', ...)`、`console.error('Smart segmentation failed:', ...)`。
- 迁移后 `titleService.generateTitleFor()` 把异常转成 `{success:false, error}` 返回，而 `useChatTitles.generateTitle()` 只 `await` 不检查结果 → 失败无日志无提示；`useChatTopics.smartSegmentation()` 对 `!result.success` 直接 `return`。
- 用桩模型验证内核侧"应用"逻辑**是正确的**（探针输出）：

```
TITLE_RETURNED "架构分层设计"   TITLE_IN_FILE "架构分层设计"
TOPIC_RETURNED "架构设计讨论"   TOPIC_IN_FILE [{"id":"t1","name":"架构设计讨论"}]
QUOTED_RETURNED "引用包裹的标题"        // 带引号/多行仍能归一化
EMPTY_FAILED 模型未返回有效标题          // 空返回会抛错
```

**结论**：失败要么发生在调用模型之前（最可能是所选/默认模型没有可用密钥），要么是模型返回被拒；迁移后这两类失败都没有任何可见线索。

**修复**：标题（单条/批量）、话题、智能分段、会话标题全部改为失败时输出 `console.error` + 界面 toast，直接显示内核返回的原因（如"缺少 API Key"、"模型未返回有效标题"）。

## R7 重命名不同步页签标题

**证据**：旧 `pagesService.updatePage()` 改名时会 `tab.updateTabTitle(...)`；迁移后 `updateTabTitle` 在 `tabsStore` 里有定义但**没有任何调用者**。受影响：Explorer 内联改名、ChatEditor 标题栏改名、AI 生成会话标题。

## R8 删除文件夹语义与文案不符

**证据**：`TreeView` 的确认文案是「将同时删除文件夹内的所有项目」（`TreeView.tsx:555-556`），而 `pagesService.deleteFolder(id)` 默认 `mode: 'promote'`（内容提升到根目录）；旧 `deleteFolder` 是级联删除。需统一（改默认值或改文案）。

## R9 折叠/展开全部逐条发命令

**证据**：旧 `setMessagesCollapsed()` 是一次内存更新 + 一次持久化；现在 `messagesService.setMessagesCollapsed()` 对每条消息发一次 `conversation.updateMessage` → N 次 IPC、N 次整文件写、N 次 `conversation.changed` 拉取（`ChatEditor/index.tsx:192-196` 的 `handleCollapseAll/handleExpandAll`）。建议批量命令。

## R10 分支切换与删除消息的落点

- 旧 `switchBranch()` 同时写 `leafMessageId`（子树最深叶）与 `selectedMessageId`（用于切换后定位）；迁移后只写 leaf。
- 旧 `deleteMessage()` 删子树后优先落到"上一个兄弟分支的叶子"；迁移后落到父消息。

## R11 更新检查

**证据**

- 本地 `2.0.0-preview.1`，GitHub 最新 release `v1.0.0-preview.24`（远程更低）。
- 旧、新实现都在 dev 下设置 `autoUpdater.allowDowngrade = true`，且两版 UI 都没有版本号比较 → **"远程更低也提示升级"不是迁移引入**，但确实不合理。
- 迁移引入的部分：`AboutPanel` 删掉了更新事件监听，旧实现在"无更新"时会 `message.info('当前已是最新版本')`，现在检查完没有任何反馈。

**建议**：加入语义版本比较（仅当远程 > 本地才提示），并恢复无更新时的提示；是否保留 dev 下的 `allowDowngrade` 需确认。

## R12 一致性小项

- 页签 id：`openPage` 用确定性 `chat-${pageId}`，`restoreTab` 用 `uuidv4()`，`openTab` 按 id 去重 → 同一页面可能出现两个页签（旧实现按 `dataId` 查重）。
- `openPage` 不再预加载消息（旧实现 `await message.load(pageId)`）。
- 删除页面/文件夹后渲染层 `messages`、`messageQueue` 缓存未 evict。
- 重名改为自动加序号，`MoveConflictModal` 成为死代码。
- `useGlobalSearch` 仍保留未使用的 `pages`/`load`（迁移残留）。

## R13 数据恢复导入丢失顺序与星标

**证据**：`ImportModal` 用完整 `Page`/`Folder` 对象调用 `create(resolved)`（`ImportModal.tsx:414-440`），而迁移后的 store 只转发 `name / parentFolderId / afterNodeId` 三个字段（`pagesStore.create`、`foldersStore.create`）→ 导入的 `order`、`starred` 被丢弃（`id` 也由内核重新生成，后续用 `pageIdMap` 映射，消息仍能对上）。旧实现是 `page.create(data)` 全量写入。

**建议**：为导入提供能携带 `starred / order` 的创建入参，或导入后用一次 `page.update` 补齐。

## 已核实为"非迁移引入"（避免误改）

- **重置数据（ResetModal）**：旧实现同样只重置内存 store，不清持久化数据。
- **字体大小设置无消费者**：新旧实现都没有把 `settings.fontSize` 应用到布局。
- **dev 下的降级更新提示**：新旧都设了 `allowDowngrade = true`。

## 验证手段

- 只读对比迁移前实现：`git show HEAD:<path>`。
- 真实数据只读检查：读取 `%APPDATA%/pointer/accounts/<id>/{settings,secrets}.json`，用 `SettingsStore` 判断密钥可读性（不输出密钥内容）。
- 临时探针（已删除）：用桩替换模型调用，验证"生成 → 应用 → 落盘 → 通知"链路。
- 现有回归：`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm smoke:kernel`。

## 待办顺序（建议）

已全部处理完毕（R4/R5 按决定不修）。若要继续加固，建议的下一步是：

1. R2 的写放大：`applyLayout` 目前对受影响层级的所有页面重写元数据块，超大工作区拖拽排序时可考虑合并为一次批量写入。
2. R13 的姊妹问题：导出侧（ExportModal）同样只导出选中页面，导入的顺序信息现在能保留，但"导出全部"的排序未做验证。
3. R11 的剩余部分：`allowDowngrade` 是否要在 dev 下保留，取决于你是否需要测试降级安装。
4. 设置写入未做去抖：编辑配置时每次按键都会 `settings.replace` 一次（迁移前有 300ms 去抖队列）。结果一致，但磁盘写入更频繁，可在 renderer 侧补一个短去抖。

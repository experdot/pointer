# Pointer 目标架构

> 状态：提案（待实现）
> 适用范围：持久层、内核执行层、展示层及其边界契约
> 相关文档：`docs/idea.crosstab.md`、`docs/idea.hypergraph.md`、`docs/idea.relation.md`（产品构想）

## 一、结论摘要

项目当前缺的不是分层命名，而是**系统 of record 放错了层**：真正的业务规则和持久化逻辑运行在渲染进程（renderer）中，主进程（main）退化成了一个通用的文件读写 API。因此调整方向不是"再分一次层"，而是把内核从 renderer 搬回 main。

目标形态为四层，依赖方向单向向下：

```
展示层 presentation（renderer / React）
    只持有：视图状态 + 服务端状态的只读镜像
    产出：intent（用户想做什么），不产出路径、不产出文件格式
        │  window.runtime: query / command / subscribe
桥接层 contracts（shared，唯一真相）
    三张映射表：Query / Command / Event + 载荷类型
        │
内核执行层 runtime（main 进程 + Node worker 线程）
    仓储与事务、原子写、索引、AI 引擎与流式生命周期、
    工作区扫描与文件监听、附件、密钥、更新
    产出：领域事件流
        │
领域内核 domain（shared，纯 TS，零副作用）
    实体、不变量、纯函数：消息树、分支规则、Topic 区间、
    文件名规则、搜索匹配
```

这是一次有界重构，而不是重写：边界虽然错，但污染范围很小——`window.api.fs` 目前只出现在三个文件中。

## 二、现状诊断

### 2.1 当前结构

```
renderer  ──  ┌ 领域规则（页面、消息树、文件名规则）
              ├ 持久层（仓库、路径拼接、写锁、去抖队列、重试）
              ├ 工作区布局（.pointer/… 的物理约定）
              └ 视图
                 │  window.api.fs.readText / writeJson / delete（绝对路径 + allowCustomPath）
                 ▼
main       ──  ┌ 通用 fs CRUD + 路径白名单（src/main/workspaceRuntime.ts）
              └ AI 流式（src/main/aiHandler.ts）
```

### 2.2 五个具体问题

1. **系统 of record 在渲染进程。**
   工作区的形态、页面文件命名、写失败重试策略、退出前 flush，全部位于 `src/renderer/src/persistence/` 与 `src/renderer/src/stores/persistenceQueue.ts`。主进程无法保证这些规则，只能无条件相信渲染进程传入的绝对路径——`allowCustomPath` 就是该信任模型的兜底逃生门。

2. **同一概念存在两套类型。**
   `src/shared/ai.ts` 的 `ChatMessage`（role / content / attachments）与 `src/renderer/src/types/type.ts` 的 `ChatMessage`（id / parentMessageId / branchIndex / reasoning_content）并不相同，中间由 `aiService` 临时转换。消息树是本项目的核心资产，反而没有明确的归属层。

3. **在 renderer 中模拟数据库语义。**
   `writeLock.ts` 实现页级互斥，`persistenceQueue.ts` 实现去抖 + 指数退避重试，`FileSystemPersistenceRegistry` 用 Proxy 追踪 in-flight promise 以支持"切换工作区前等待空闲"。这些是事务与耐久性需求，本该由内核提供，现在用数百行 JS 在调用方模拟。

4. **路径逻辑有两套实现。**
   `src/renderer/src/persistence/implementations/filesystem/core.ts` 手写 `joinPath`（浏览器环境没有 `path` 模块），`src/main/workspaceRuntime.ts` 另有一套 `path.resolve` + `isPathWithinRoot`。两者必须永远保持一致，否则会出现越权或写错位置。

5. **状态只有一半是真话。**
   流式过程中的消息只存在于 `streamingManager` 中，完成后才写回 store 再落盘。以下三种情况当前架构没有答案：
   - 用户（或外部工具）直接修改 `.pointer.md` 文件：无文件监听，renderer 缓存了 filePath 却不知道文件已变。
   - 应用在写入过程中崩溃：页面文件可能只写了一半。
   - 两个窗口同时打开同一工作区：没有写者仲裁。

### 2.3 有利条件

`window.api.fs` 只出现在三处：

- `src/renderer/src/persistence/implementations/filesystem/core.ts`
- `src/renderer/src/persistence/implementations/filesystem/index.ts`
- `src/renderer/src/components/layout/activitybar/WorkspaceCard.tsx`

其余 renderer 代码都通过仓库接口访问持久化。因此迁移是有界重构，可以分步发布。

## 三、目标架构与所有权边界

| 层                                  | 必须拥有                                                            | 绝对不做                                |
| ----------------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| domain（`src/shared/domain`）       | 实体定义、不变量、树/分支/Topic 纯函数、搜索匹配算法                | 任何 IO、任何 Electron API、任何 React  |
| runtime（`src/main/runtime`）       | 持久化、事务与原子性、索引、AI 调用与流式状态机、文件监听、密钥保管 | 不理解 UI 概念（tab、选中项、滚动位置） |
| contracts（`src/shared/contracts`） | query / command / event 的类型与通道名                              | 任何实现代码                            |
| presentation（`src/renderer`）      | 视图状态、乐观更新、渲染                                            | 不构造路径、不序列化文件、不重试写盘    |

### 3.1 目录结构建议

```
src/
├── shared/                 # 无副作用，两个进程共享
│   ├── domain/             # 实体 + 不变量 + 纯函数
│   │   ├── account.ts  workspace.ts  chat.ts
│   │   ├── settings.ts search.ts  persistence.ts
│   │   └── index.ts
│   ├── contracts/          # Query / Command / Event 三张映射表
│   └── ai.ts               # AI 协议类型（provider 请求/响应）
├── main/                   # 内核执行层
│   ├── runtime/
│   │   ├── core.ts         # 装配与生命周期
│   │   ├── RuntimeWorkerHost.ts
│   │   ├── workspace/      # 目录扫描、页面文件读写（原子写）、索引
│   │   ├── conversation/   # 消息树命令、分支、Topic、消息队列
│   │   ├── ai/             # provider adapter + streaming engine
│   │   ├── attachments/
│   │   ├── search/         # FTS 索引与查询
│   │   └── secrets/        # safeStorage 密钥保管
│   ├── ipc/                # 仅做 contracts → runtime 的映射
│   ├── window.ts  autoUpdater.ts
│   └── index.ts
├── preload/
│   └── index.ts            # 只暴露 window.runtime = { query, command, subscribe }
└── renderer/
    └── src/
        ├── app/            # 装配、页签与布局
        ├── features/       # 按功能切分：chat / export / settings / search
        └── shared/ui/      # 通用 UI 组件
```

## 四、内核执行层设计

### 4.1 运行位置

主进程持有 runtime，但把重活（SQLite、目录扫描、Markdown 解析、全文索引）放进 worker 线程，主线程只负责窗口与 IPC 转发。

`refactor-v2` 分支中的 `RuntimeWorkerHost` + `runtimeWorker` + `RuntimeCore` 方向正确，但应把它理解为**层边界**而非"用了 worker"：边界清晰后，同一个 runtime 可以脱离 Electron 运行（headless CLI、集成测试、未来的本地 daemon），这才是真正的收益。

### 4.2 AI 子系统拆分

将现有 `src/main/aiHandler.ts` 拆为三部分：

- **provider adapter**：吸收协议差异（OpenAI 兼容 / Anthropic / DeepSeek 的 `reasoning_content` 等）。
- **streaming engine**：request 生命周期、中止、重试、错误态、事件发射。
- **调用方**：会话命令（发送、重试、续写）、标题生成、自动提问。

### 4.3 密钥

当前 API Key 以明文存在于 renderer 内存并通过 IPC 传输，同时明文存放在账户目录的 JSON 中。目标做法：

- renderer 只传 `llmConfigId`；
- 密钥由 main 用 `safeStorage` 加密保管；
- 配置的读取接口默认不返回明文密钥（返回 `hasApiKey: boolean` 之类的元信息）。

## 五、持久层设计

采用三级结构，而非在"纯文件"与"数据库"之间二选一。

### 5.1 canonical 层：工作区文件

`.pointer/` 下的 Markdown 文件继续作为唯一真相。这是产品卖点（对话可读、可迁移、可纳入 git），应当保留。但需要改变两点：

- **writer 必须是 main**，采用 `写临时文件 → fsync → rename` 保证原子性；
- **文件命名、唯一名生成、目录归属规则从 `pagesRepository` 移入 runtime**。

### 5.2 索引层：`.pointer/index.db`

使用 `node:sqlite`（Electron 35 自带的 Node 具备该模块，`refactor-v2` 已在使用 `DatabaseSync`）。表结构服务于两类查询：

- 页面与文件夹树；
- 消息全文检索（FTS5），供全局搜索使用。

关键性质：**派生且可重建**。索引损坏时扫描目录即可恢复，用户数据不受影响。这也是当前 `scanPageFiles` + 内存 `Map` 缓存方案的正解——目前全局搜索是 renderer 侧 O(全部消息) 的内存扫描。

### 5.3 内存层

main 中按 `workspaceId` 分区的实体缓存，承载流式增量与尚未落盘的改动。

### 5.4 写入语义

现实约束：页面是 Markdown + frontmatter，修改一条消息必然重写整个文件。因此不应在 renderer 中对每次变更去抖后写盘（当前行为），而应：

1. 流式过程中**完全不落盘**，仅在内存累积并向 renderer 推送事件；
2. 完成或中止时提交一次，由 main 端合并（单写者，无需 renderer 侧写锁）；
3. 为防崩溃，增加 append-only journal（`.pointer/journal/*.jsonl`），按固定时间间隔或字符数追加，用于在恢复时还原"上次生成中断"的消息；
4. 外部编辑 `.pointer.md` 通过 `fs.watch` 监听，发出 `workspace.externalChange` 事件，由 renderer 提示冲突。

## 六、桥接层契约

### 6.1 运行时端口

```ts
export interface RuntimePort {
  query<K extends QueryName>(name: K, payload: QueryPayload<K>): Promise<QueryResult<K>>
  command<K extends CommandName>(name: K, payload: CommandPayload<K>): Promise<CommandResult<K>>
  subscribe(listener: (event: RuntimeEvent) => void): () => void
}
```

### 6.2 事件示例

```ts
export type RuntimeEvent =
  | { type: 'chat.delta'; pageId: string; messageId: string; text: string }
  | { type: 'chat.completed'; pageId: string; message: ChatMessage }
  | { type: 'chat.failed'; pageId: string; messageId: string; error: string }
  | { type: 'page.put'; page: PageRecord }
  | { type: 'workspace.externalChange'; pageId: string }
  | { type: 'queue.changed'; pageId: string }
```

### 6.3 关键约束

- 命令中**不出现路径**、文件名与 `allowCustomPath`。renderer 表达"将页面 X 重命名为 Y"，落在哪个文件、如何原子写入由内核决定。
- 从 preload 中整体撤掉泛型 `fs:*` 通道。这既是当前架构最大的攻击面，也顺带消除了"两套路径实现必须一致"的问题。
- 密钥不出 main。

## 七、展示层设计

### 7.1 store 中只保留两类状态

- **视图状态**：选中的 tab、展开的文件夹、草稿输入、滚动锚点；
- **服务端状态的镜像**：按 `(workspaceId, pageId)` 归一化缓存的实体，全部由事件驱动更新。

### 7.2 由此可以删除的机制

- `writeLock`（写锁）；
- `persistenceQueue`（去抖与重试队列）；
- `flush-on-quit` 握手（主进程目前需要 `preventDefault` 退出、请求渲染进程 flush、收到完成后再退出）；
- `tryGetCurrentWorkspaceScope` 一类"当前作用域"全局态；
- `switchTransactionStore` + 遮罩 + 清空全部 store 的切换流程——改为 main 执行 `session.selectWorkspace`，renderer 按 scope key 丢弃缓存并重新订阅。

### 7.3 计算下沉

以下内容当前位于 renderer，但本质是纯领域逻辑，应移入 `src/shared/domain` 并补单元测试：

- `services/messagesService.ts` 的 `buildMessageMaps`；
- `utils/treeUtils.ts`；
- Topic 区间计算与大纲生成。

项目当前没有任何测试文件，而这一层是成本最低、收益最高的测试切入点（建议 vitest）。

### 7.4 可以简化的间接层

`src/renderer/src/stores/registry.ts` 与 `stores/interfaces/` 下的 6 个文件，用 getter 做间接访问是为了绕开循环依赖。在客户端应用中 Zustand store 本身就是单例，分层理清后可直接 import。仅当确实需要多实例（例如同一应用同时打开多个工作区）时，保留注册表才有价值。

## 八、迁移路线

分五步，每一步都可独立发布。

1. **抽出 `shared/domain`**：实体 + 不变量 + 树/搜索纯函数，引入 vitest。renderer 行为不变，只改 import 路径。
2. **定义契约**：`shared/contracts` 中的三张映射表 + preload 暴露 `window.runtime`（可先用现有 IPC 实现，先换语义）。
3. **搬迁持久层**：`filesystem/*` 仓库整体移入 main 的 runtime，文件格式一字不改（同时完成原子写改造），renderer 改为调用命令。此步完成后即可从 preload 删除 `window.api.fs`。
4. **搬迁会话状态**：流式生命周期、消息队列、标题生成移入 runtime；删除 `streamingManager`、`switchTransaction*`、`persistenceQueue`、`writeLock`。
5. **加入索引与监听**：SQLite 索引 + 全文搜索 + 外部变更监听，将全局搜索从 renderer 内存扫描改为 `search.workspace` 查询。

## 九、反模式（明确不做）

- 不在 renderer 中继续加厚"迷你数据库"（更多锁、更多队列）——那是往错误方向加固。
- 不为分层而分层：不需要 abstract factory，也不需要依赖注入容器。Electron 应用中 main 即单例，契约类型 + 一个 runtime 实例足够。
- 不把 domain 层做成"实体 + 一堆贫血 setter"。不变量必须写进去，例如：
  - 分支索引在同一父节点下唯一；
  - Topic 区间必须落在同一路径上。
    否则它只是一个类型文件夹。
- 不急于把真正的数据库当作唯一真相。文件是产品特性，SQLite 只承担索引角色；顺序反过来会丢掉可移植性。

## 十、关于 `refactor-v2` 分支

该分支的技术判断（领域层、契约、worker、SQLite）与本文方向一致，但它一次性改动 152 个文件，并顺带将 UI 迁移到 Tailwind + streamdown、移除 KaTeX/mermaid，把架构迁移与 UI 改版绑定在一起，导致难以 review、难以回滚。

建议拆分处理：

1. 领域与契约（无行为变化）；
2. main 侧 runtime；
3. UI 迁移（独立评估）。

另外，约 6k 行删除中若包含 KaTeX / mermaid 这类功能性回退，需单独确认是否为有意为之——`main` 分支当前仍保留这两项能力（`katex`、`mermaid`、`rehype-katex`、`remark-math`）。

## 附录：待确认问题

- 是否需要支持同一工作区多窗口同时打开？若需要，写者仲裁与冲突提示的策略需先行定义。
- 流式 journal 的落盘频率需在"崩溃恢复完整度"与"磁盘写入量"之间取值（建议以时间间隔为准，如 2 秒）。
- `.pointer.md` 的 frontmatter 是否需要扩展版本号字段，以便未来做格式演进与迁移。

## 附：迁移进度

### 已完成

**领域层（`src/shared/domain`）**：纯 TypeScript、零副作用，覆盖实体、不变量与算法。
包含 `common`、`account`、`workspace`、`page`、`naming`、`layout`、`chat`、`messageTree`、
`outline`、`queue`、`search`、`configTree`、`settings`、`pageFile`、`importers`，
配 10 个测试文件、78 个用例（`pnpm test`），可脱离 Electron 运行。

**桥接层（`src/shared/contracts`）**：`RuntimePort` 与 Query / Command / Event 三张映射表；
`RuntimeError` 携带稳定错误码；`ViewState` 作为不透明展示层文档。

**内核执行层（`src/main/runtime`）**：

- `paths` / `fsx`：路径解析与原子写（临时文件 + fsync + rename）
- `AccountStore` / `WorkspaceRegistry`：账户、工作区注册表与工作区身份校验（含路径修复）
- `WorkspaceStore`：页面树与磁盘对齐（布局是元数据的纯函数）、会话读写、会话缓存、外部改动检测、附件
- `IndexDb`：SQLite 索引（FTS5 trigram 全文 + 页面表），派生且可重建
- `SettingsStore`：设置与 `safeStorage` 加密密钥
- `ViewStateStore` / `QueueStore`：展示层状态与消息队列
- `providers` / `ChatEngine`：OpenAI 兼容协议适配与流式生命周期（落盘时机、中止、错误、队列自动出队）
- `SearchService`：索引缩小候选 + 领域匹配器精确命中
- `RuntimeCore`：会话切换、查询/命令分发、事件广播、工作区文件监听
- `src/main/ipc/runtimeIpc.ts` 与 preload 的 `window.runtime`：渲染进程唯一入口

**验证**：`pnpm smoke:kernel` 在临时目录中启动完整内核，覆盖账户、工作区创建与切换、
文件夹与页面、会话与分支序号、Markdown 落盘、全局检索、设置与密钥标记、消息队列、
第三方导入、事件流，共 17 项检查全部通过。

### 待完成

**渲染进程迁移**：删除 `src/renderer/src/persistence/`（整个仓库层、写锁、去抖队列、
markdown 编解码）、`types/type.ts` 的重复实体定义、`aiService`、`streamingManager`、
`switchTransaction*`、`stores/registry` 与 `stores/interfaces`。
新增 `runtime/client.ts`（内核客户端）、`runtime/bootstrap.ts`（事件 → store 镜像装配）、
`runtime/generation.ts`（会话代际，替代原来的切换事务）。
store 全部改写为镜像 + 命令；服务层退化为命令封装；聊天 hook 直接消费 `chat.*` 事件。

**主进程收口**：删除 `aiHandler`、`fsHandlers`、`attachmentHandler`、`attachmentStorage`、
`workspaceRuntime`（路径白名单不再需要）与旧 `ipcHandlers`；`src/main/index.ts` 只做窗口、
内核装配、IPC 接线与退出释放；自动更新改为向内核回报状态。

**preload 收窄**：只暴露 `window.runtime`（查询/命令/事件）、`window.electronWindow`、
`window.shortcuts`；`window.api.*` 整体移除，渲染进程不再具备文件系统能力。

**验证**：`pnpm typecheck`、`pnpm lint`、`pnpm test`（83 个用例，含镜像层契约测试）、
`pnpm smoke:kernel`（17 项内核检查）、`pnpm build` 与 `pnpm dev` 启动均通过。

### 仍未完成（保持目标未结）

- **内核尚未移入 worker 线程**：当前 `RuntimeCore` 直接运行在主进程。存储与索引均为异步 IO，
  但大工作区扫描会占用主线程。契约已按可搬迁设计（`RuntimeHost` / `RuntimeUpdater` 注入），
  下一步是把内核搬入 `node:worker_threads` 并加入 worker 消息协议。
- **未实现流式 journal**：崩溃时正在生成的消息会丢失（用户消息仍已落盘，可直接重试）。
  需要按 §5.4 增加 append-only journal 与恢复流程。
- **附件垃圾回收缺失**：附件在导入时即写入工作区，未被引用的附件目前不会清理。

### 不变量（迁移后新增，务必保持）

- **元数据必须立即落盘**：星标、名称、顺序、父文件夹等页面元数据变更后，必须立刻写回页面文件的 `<pointer-page>` 块（`WorkspaceStore.persistPageMetadataDiff`）。磁盘文件是元数据的权威副本，任何"只改内存"的路径都会在下一次目录扫描时被回滚。
- **页签与缓存由镜像对齐**：页面被删除后关闭其页签并清理会话/队列缓存，改名后同步页签标题，全部由 `runtime/bootstrap.ts` 在 `tree.changed` 时完成，服务层不再手工维护。
- **批量写操作用批量命令**：对多条消息做同一处修改时使用 `conversation.updateMessages`，避免逐条重写会话文件。
- **行为对齐迁移前**：分支切换（叶子下沉 + 选中定位）、删除消息后的落点、文件夹删除（单个级联 / 批量提升）、导入保序等语义都以迁移前的 `main` 分支为准。

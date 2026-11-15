# 测试与验证

## 分层入口

要求 Node 22.12–22.x（仓库使用 22.16.0）及 pnpm 10.26.2。
首次安装运行 `pnpm install --frozen-lockfile`。

| 命令                 | 范围                                                       |
| -------------------- | ---------------------------------------------------------- |
| `pnpm test`          | 全部快速测试：领域、内核、IPC 单测、镜像及 DOM 组件        |
| `pnpm test:unit`     | 领域算法、主进程适配器及 preload 单测                      |
| `pnpm test:kernel`   | 真实临时工作区、SQLite、生成及故障恢复                     |
| `pnpm test:renderer` | 状态镜像和真实挂载的 React Hook/组件                       |
| `pnpm test:coverage` | 快速测试及 V8 覆盖率，输出到 `coverage/`，包含未执行源文件 |
| `pnpm test:stress`   | 大数据、固定种子随机序列及资源预算                         |
| `pnpm test:release`  | 临时 Git 仓库中的 tag/提交校验、CLI 失败及草稿 API 回归    |
| `pnpm test:e2e`      | 构建后运行真实 Electron 桌面流程                           |
| `pnpm smoke:kernel`  | Electron 环境下的内核命令链检查，不经过窗口或 IPC          |
| `pnpm check:bundle`  | 检查现有生产构建的入口和总 JS 体积；`pnpm build` 自动执行  |

配置采用 [Vitest projects](https://vitest.dev/guide/projects.html) 区分执行环境，
组件使用 [React Testing Library](https://testing-library.com/docs/react-testing-library/api/)，
桌面流程使用 [Playwright Electron](https://playwright.dev/docs/api/class-electron)。
jsdom 固定在兼容仓库 Node 版本的 26.x。

## 用例约束

- 测试使用独立临时目录和测试专用模型凭据，不读取用户工作区。
- 网络协议测试使用本地服务或可控流，不依赖远端模型的速度、余额或回复。
- 故障用例检查返回值、事件、内存、磁盘和重新打开后的状态。
- 树节点拖拽分层验证：领域层 `treeMove` 覆盖相对位置与不变量；内核 `treeMove` 覆盖单事务、提交后单次广播、文件监听不重复广播、落盘失败回滚、队列中的目标变化及重名；展示层 `TreeView` / `usePages` 验证单条移动意图；桌面 `explorer` 验证真实拖拽、重名确认及重启后的顺序。
- 内核 `simplification` 覆盖外部编辑后抢先读取及改名的索引一致性、读取不创建写事务、私有文件写入不触发扫描、监听错误与目录删除竞态、事务上下文隔离、改名不中断生成、账号与工作区选择恢复、遗留会话文件的忽略、根目录移动和话题返回值。桌面 `explorer` 同时验证菜单移动、跨类型重名和自动命名。
- 异步顺序使用可控 promise/流；只有行为本身涉及去抖时使用假时钟。
- 临时目录清理前验证绝对路径；监听、SQLite、流和窗口都须释放。
- 回归用例断言预期行为，修复前应失败，不将错误行为固化为通过断言。
- 覆盖率用于定位遗漏；桌面、故障恢复和数据完整性仍需对应行为断言。

## 行为约定

- 同一工作区只允许一个活动内核持有写入权，冲突明确报错。
- SSE 保留无尾部空行/无 DONE 的正常 EOF 兼容；网络异常必须报告失败。
- 队列暂只支持文字；附件不能被静默丢弃，应在入口明确阻止入队。
- 第三方导入以单个文件为事务，失败回滚该文件；跨文件汇总已完成数。备份恢复逐项提交，当前页面失败回滚该页面；两种入口均不自动重复提交整批。
- API Key 的本地明文存储和备份不打包附件沿用现有设计，界面应明确导出密钥的选择。
- CSV 面向表格软件的导出按文本保护公式前缀；原始文本和代码导出保持字面内容。

## 覆盖矩阵

树排序统一使用 `fractional-indexing@4.0.0` 默认格式的 `orderKey`。页面文件为 v3，JSON 备份为 `2.0.0`，测试夹具均直接构造新格式；发送队列的数字 `order`、消息 `branchIndex` 保持原语义。旧页面版本、缺失键、非法键及旧备份必须明确拒绝。

- `shared/domain/ordering`、`treeMove`：空目录、头尾／中间插入、混合节点、跨目录、循环、无效目标、无操作、重复组修复，以及连续向同一间隙插入一万次。
- `renderer/stores/settingsStore`：配置移动和插入意图在版本冲突后基于最新邻居重放；无操作不提交设置。
- `main/runtime/ordering`：新建／插入只写新增页面；同级页面移动仅写自身；同级文件夹移动不写页面；无操作不写盘、不广播。校验正文逐字节不变、排序不重建消息全文索引、外部重复键只修复组内节点、重启次序和旧格式拒绝。
- `backup`、`imports`、`treeMove`、`workspaceCrash`：批量恢复混合层级次序、三种冲突策略、缺失父级提升、原子写失败回滚、真实进程中断恢复。目录搬迁故障注入使用实际跨目录子树移动，排序不再触发同名目录交换。
- `tests/stress/ordering`：一万混合节点，反复远距离排序，每次只替换一个节点。
- Electron `explorer.spec.ts`、`configOrdering.spec.ts`：真实拖拽、菜单移动、冲突处理，以及 LLM／模型配置的新建、复制、跨目录和重启恢复。
- 主进程 `index.test.ts`：内核初始化失败时显示原因与数据目录，释放资源并以非零状态退出；旧格式拒绝、初始化前失败，以及清理或对话框失败都不会留下未处理的 Promise 拒绝。启动失败不会自动清空或转换数据。

性能复现：改动前执行 `node scripts/build-ordering-benchmark.mjs baseline` 保存旧实现（脚本拒绝覆盖已有基线）；改动后执行 `node scripts/build-ordering-benchmark.mjs current`，再运行 `node scripts/benchmark-ordering.mjs <工作区路径>`。脚本为每种实现、每个场景创建独立临时副本，只在测试准备阶段将旧顺序转换为 v3 字符串键，并校验正文未变。复制、转换、建立索引和重启准备不计入操作耗时。

每场景记录首次及十次后续执行的命令提交、首次读取、同一路径的监听扫描耗时，输出中位数、P95、文件 IO／字节数、刷盘次数、旧页面写入数和全文索引调用次数。扫描手动单独触发，排除 600ms 去抖；Node 文件 IO 包括事务备份与清单，SQLite 原生 IO 不计入文件计数但耗时计入命令。报告不含页面名称、ID、文件路径或会话正文，结束时核对源目录全部文件 SHA-256 并清理所有副本。

下表列出各功能的主要测试入口。

| 方向              | 覆盖重点                                                                            | 主要测试入口                                                               |
| ----------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. 文件布局       | 目录交换、同名清理、移动失败、无关文件、多实例、真实进程中断恢复                    | `workspaces`、`WorkspaceLease`、`WorkspaceTransaction`、`workspaceCrash`   |
| 2. 账户与工作区   | 增删改、身份/注册/选择写入失败、切换回滚、事件与重启                                | `workspaces`、`runtime/bootstrap`                                          |
| 3. 消息与页面文件 | 深链、分支、循环、损坏输入、序列化往返                                              | 领域测试、`pageFile.boundaries`、压力测试                                  |
| 4. 对话生命周期   | 发送、重试、继续、父消息删除、终态保存、提交前禁止请求                              | `chatLifecycle`、内核 `review`、`useChatActions`、桌面 `chat`              |
| 5. 消息队列       | 编辑、移除、暂停、恢复、出队写入失败和重复请求                                      | `chatLifecycle`、`useChatActions`、内核 `review`                           |
| 6. 输入区         | 发送失败保留草稿、重复回车、IME、在途新内容、附件入口                               | `InputArea`、`useDraftField`、`useAttachment`                              |
| 7. 模型协议       | 参数、图片上下文、分片、Unicode、HTTP 错误、断流、取消                              | `providers.integration`、内核 `review`                                     |
| 8. 附件与文件     | 字节往返、重启、路径限制、批量回滚、删除失败、原生保存                              | `attachments`、`runtimeHost`、桌面 `content`                               |
| 9. 搜索内核       | 2001 条候选、Unicode/日期/目录/角色、正则超时、线程并发和资源预算                   | `search.integration`、`SearchExecutor`                                     |
| 10. 搜索界面      | 乱序、清空、卸载、错误恢复、切分支、展开话题和滚动                                  | `useGlobalSearch`、`useSearchHighlight`、`navigationService`、桌面 `chat`  |
| 11. 标题与分段    | 三类标题、目标删除/切换、批量失败、分段去重与完成数量                               | `titles`、`titleService`                                                   |
| 12. 配置          | CRUD、复制和移动、默认引用清理、立即连接测试、保存重试                              | `settingsStore`、`LLMConfigPanel`、领域 `configTree`、桌面 `chat`          |
| 13. 第三方导入    | 三类格式、预览/筛选/勾选、单文件回滚、多文件汇总                                    | `importers`、`imports`、`thirdPartyImportService`、`ThirdPartyImportModal` |
| 14. 备份恢复      | 界面实际 JSON、默认配置、密钥选项、空文件夹、冲突策略和 UI 引用                     | `ExportModal`、内核 `backup`                                               |
| 15. 内容导出      | 13 种来源/格式组合、代码字面量、CSV、HTML、多标签、预览竞态和出口失败               | `exportMatrix`、`tables`、`exportStore`、`TableViewModal`                  |
| 16. 富文本        | 公式、代码、未闭合流式内容、复制、真实 Mermaid、全屏表格与 PNG                      | `prepareMarkdown`、`Markdown`、`clipboard`、桌面 `content`                 |
| 17. 标签与快捷键  | 预览/固定/排序/历史、失效页、焦点、IME、Monaco、模态遮罩                            | `tabsStore`、`navigationService`、`shortcutGuards`、桌面测试               |
| 18. IPC 与关闭    | 关闭握手的 sender/请求关联、超时清理、真实 bridge 错误、订阅取消、关闭失败取消/重试 | `runtimeIpc`、`runtime/client`、桌面 `chat`/`content`                      |
| 19. 更新          | 合并检查、失败重试、下载进度、安装前保存、版本查询次数                              | `autoUpdater`、`AboutPanel`、`useSavedAction`                              |
| 20. 工程保障      | 固定种子大树、流式落盘次数、覆盖率门槛、产物预算、CI 报告                           | `tests/stress`、`vitest.config.ts`、`check-bundle.mjs`、CI                 |

### 验证记录

2026-11-11，本地 Windows / Node 22.16.0 / pnpm 10.26.2：

- 快速测试：62 个文件，412 项通过，包含旧收藏面板状态的兼容恢复。
- 压力测试：24 项通过；内核 smoke：23/23 通过。
- 发布回归：29 项通过，包含三平台产物命名和打包配置检查。
- Electron：5 个场景，涵盖真实 preload、聊天分支/搜索/重启、附件/富文本/图片保存、链接限制及关闭失败恢复。
- Windows NSIS 打包通过；将归档复制到仓库外的独立临时目录，验证主进程/preload/界面启动、代码高亮、公式、Mermaid 和 Monaco 导出编辑。此检查使用测试 Electron 启动归档，不代替安装验收。
- ESLint、三个 TypeScript 项目、生产构建和体积预算均通过。
- V8 全量覆盖率：语句 54.71%、分支 46.50%、函数 47.86%、行 55.84%。领域层行覆盖率 95.84%，内核 91.33%，渲染层 35.80%。

覆盖率报告包含未执行文件。门槛按语句/分支/函数/行配置为：全局 `50/43/43/50`，
领域 `90/78/94/93`，内核 `82/69/85/85`，渲染层 `30/24/26/31`。
真实 Electron 场景独立执行，不计入上述 V8 百分比。

2026-11-14，树节点移动改造，本地 Windows：

- 全量快速测试：66 个文件，454 项通过。
- 资源管理器 Electron 回归：2 项通过，覆盖重启后拖拽、同级混合排序、跨目录移动、单次最终树事件与重名确认。
- ESLint、三个 TypeScript 项目、生产构建和体积预算均通过。

2026-11-14，main / shared 精简改造（提交 `e493179`），本地 Windows / Node 22.16.0 / pnpm 10.26.2：

- 全量快速测试及覆盖率：68 个文件，471 项通过；全局及各层覆盖率门槛均通过。全局语句 57.63%、分支 49.56%、函数 51.44%、行 58.82%。
- 压力测试 24 项通过，包含两万条深链、宽树、随机树的校验与文件往返；内核 smoke 23/23 通过。
- 发布脚本回归 29 项通过；三个 TypeScript 项目、ESLint、生产构建及体积预算通过。
- Electron 原有 10 个场景通过；新增菜单移动场景修正 Ant Design 中文按钮空格的测试定位后单独重跑通过，覆盖跨类型重名、自动命名、移回根目录及重启恢复。

同日还原模型相关改造：模型字段、导入、文件编解码和配置解析恢复为 `fa3c210` 的行为，其余修复保留。还原后全量快速测试 68 个文件、469 项通过，三个 TypeScript 项目及 ESLint 通过。

同日移除 `session.json` 及迁移逻辑、账号文件的版本字段：全量快速测试 68 个文件、472 项通过，三个 TypeScript 项目及 ESLint 通过。覆盖账号与工作区选择恢复、冲突或损坏的遗留会话文件被忽略，以及正常保存时省略账号文件的旧版本字段；原有选择保存失败和切换回滚用例继续通过。

2026-11-15，修复工作区监听器未处理异步错误，本地 Windows / Node 22.16.0 / pnpm 10.26.2：全量快速测试 68 个文件、476 项通过，无未处理异常；三个 TypeScript 项目及 ESLint 通过。新增 4 项故障注入回归，覆盖事务目录消失时不扫描、普通目录消失时同步删除与索引清理、权限与监听资源错误记录警告，并验证错误后真实文件修改仍能被同步。4 项用例均已验证修复前失败、修复后通过；Linux 原生递归监听竞态仍需由对应平台 CI 验证。

### 资源预算与报告

- 正则匹配在真实 worker 中执行：启动最多 5 秒，ready 后匹配最多 1 秒，输入最多 32 MiB（UTF-16 字节估算），最多 5 万条返回结果、两个活动任务；新任务超过并发上限时取消最旧任务。领域匹配器保留原有每条消息最多 100 个匹配的限制。
- 两万节点深/宽/随机树和固定种子输入验证可终止、顺序和内容往返；1000 个流式片段只产生用户消息和助手终态各一次页面写入。
- 构建预算：主入口 850000 B，preload 16000 B，renderer 入口 14500000 B，renderer 全部 JS 42000000 B。当前约为 758 KB / 3 KB / 13.23 MB / 37.75 MB。
- `coverage/` 提供 HTML、LCOV 和 JSON 汇总；`playwright-report/` 提供桌面报告；`test-results/` 保留失败截图、trace，以及富文本和表格 PNG 示例。运行新的桌面套件会清理上一轮桌面产物。
- Windows CI 先构建并完成类型检查，桌面测试复用该构建，最后上传报告；Linux/macOS CI 执行快速测试和压力测试。三个平台均执行 `test:release`。PR、`main` 和 `release/**` 推送触发校验，也可通过 `workflow_dispatch` 手动触发。
- 发布工作流将同一个提交 SHA 传入各平台校验。Windows 桌面测试通过后上传 `release-build-windows`；Linux/macOS 完成快速测试、压力测试及生产构建后分别上传 `release-build-linux`、`release-build-macos`。各平台打包任务复用本平台的构建产物，保留 7 天。
- 发布回归还覆盖共享草稿的并发读取、错误草稿/发布类型、三平台产物和 macOS 双架构缺失、未完成或零字节附件。Windows job 运行一次 electron-builder 配置和产物命名检查，覆盖三个目标平台。所有 GitHub API 均模拟，不上传真实产物。

### 验证边界

- 本文记录的本地执行环境为 Windows。Linux/macOS 校验及打包工作流已配置，实际成功状态以远端 Actions 为准；本地不能代替这两个平台的安装验收。真实 Electron 桌面端到端测试当前仅在 Windows 执行。
- 原生保存/关闭对话框在桌面测试中提供确定的返回值；文件写入、preload、窗口关闭和重启仍走真实应用链路。模型请求使用本地 HTTP/SSE 服务。
- 进程中断恢复测试覆盖真实子进程退出，不代表已经验证断电、硬件缓存损坏或所有网络盘语义。
- 队列提交后、请求发出前发生进程崩溃时不会自动重发；本轮不实现网络请求的崩溃后恰好一次执行。
- API Key 的本地明文存储和备份附件仅保留引用的设计保持不变；备份默认不含密钥，用户可显式勾选。

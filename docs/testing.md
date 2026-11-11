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

## 补测进度

以下清单保留完整目标，只有用例与对应检查实际通过后才标为完成。

### 已落地的第一批

2026-11-11 本地 Windows / Node 22.16.0 验证记录：快速测试 36 个文件、268 项通过；
压力测试 23 项通过；kernel smoke 23/23；lint、类型检查和生产构建通过。
V8 初始全量基线为语句 39.07%、分支 34.01%、函数 32.35%、行 39.51%，
报告包含尚未执行的源文件，不能据此认为桌面流程已覆盖。
按目录汇总的行覆盖率：领域层 94.47%、内核 86.77%、渲染层 13.37%。
该批建立了内核故障基线，后续批次补齐了渲染交互和真实桌面链路。

| 新增套件                                                                   | 已验证内容                                                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `workspaces.test.ts`、`WorkspaceLease.test.ts`                             | 损坏目标切换、最后工作区删除、非当前工作区通知、目录修复、账户切换删除、目录碰撞及移动故障回滚、无关目录保护、并发写入权与失效锁恢复 |
| `chatLifecycle.test.ts`                                                    | 重新生成/继续生成的分支上下文、父消息删除、网络失败、队列编辑删除和出队故障                                                          |
| `providers.integration.test.ts`                                            | 本地 HTTP 请求参数、图片上下文、分片、401/429/500、模型目录和连接检查、取消及真实断流                                                |
| `search.integration.test.ts`                                               | 2001 条候选、角色/目录/日期过滤、Unicode 字符及大小写、字面通配符与整词位置                                                          |
| `InputArea.test.tsx`、`useDraftField.test.tsx`、`useGlobalSearch.test.tsx` | 草稿/附件确认、输入期间新内容、中文事件顺序、清空/乱序/卸载/重试                                                                     |
| `runtimeIpc.test.ts`、`runtimeHost.test.ts`、`autoUpdater.test.ts`         | IPC 错误/广播/关闭握手、文件对话框及二进制往返、更新失败和重试                                                                       |
| `pageFile.boundaries.test.ts`、`tests/stress/pageFile.test.ts`             | 深链栈保护、损坏引用保留、两万条深/宽/随机树和固定种子往返                                                                           |

### 完整覆盖矩阵

20 个补测方向均已落地；下表列出主要用例入口，旧有领域和内核回归仍一起执行。

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

- 快速测试：62 个文件，411 项通过。
- 压力测试：24 项通过；内核 smoke：23/23 通过。
- Electron：5 个场景，涵盖真实 preload、聊天分支/搜索/重启、附件/富文本/图片保存、链接限制及关闭失败恢复。
- ESLint、三个 TypeScript 项目、生产构建和体积预算均通过。
- V8 全量覆盖率：语句 54.53%、分支 46.35%、函数 47.68%、行 55.63%。领域层行覆盖率 95.39%，内核 91.33%，渲染层 35.57%。

覆盖率报告包含未执行文件。门槛按语句/分支/函数/行配置为：全局 `50/43/43/50`，
领域 `90/78/94/93`，内核 `82/69/85/85`，渲染层 `30/24/26/31`。
真实 Electron 场景独立执行，不计入上述 V8 百分比。

### 资源预算与报告

- 正则匹配在真实 worker 中执行：启动最多 5 秒，ready 后匹配最多 1 秒，输入最多 32 MiB（UTF-16 字节估算），最多 5 万条返回结果、两个活动任务；新任务超过并发上限时取消最旧任务。领域匹配器保留原有每条消息最多 100 个匹配的限制。
- 两万节点深/宽/随机树和固定种子输入验证可终止、顺序和内容往返；1000 个流式片段只产生用户消息和助手终态各一次页面写入。
- 构建预算：主入口 850000 B，preload 16000 B，renderer 入口 14500000 B，renderer 全部 JS 42000000 B。当前约为 758 KB / 3 KB / 13.23 MB / 37.75 MB。
- `coverage/` 提供 HTML、LCOV 和 JSON 汇总；`playwright-report/` 提供桌面报告；`test-results/` 保留失败截图、trace，以及富文本和表格 PNG 示例。运行新的桌面套件会清理上一轮桌面产物。
- Windows CI 执行完整链路并始终上传报告；Linux/macOS CI 执行快速测试和压力测试。三个平台均执行 `test:release`。PR、`main` 和 `release/**` 推送触发校验，也可通过 `workflow_dispatch` 手动触发。
- 发布工作流将同一个提交 SHA 传入各平台校验。Windows 桌面测试通过后上传 `release-build-windows`；Linux/macOS 完成快速测试、压力测试及生产构建后分别上传 `release-build-linux`、`release-build-macos`。各平台打包任务复用本平台的构建产物，保留 7 天。
- 发布回归还覆盖共享草稿的并发读取、错误草稿/发布类型、三平台产物和 macOS 双架构缺失、未完成或零字节附件。Windows job 运行一次 electron-builder 配置和产物命名检查，覆盖三个目标平台。所有 GitHub API 均模拟，不上传真实产物。

### 验证边界

- 本文记录的本地执行环境为 Windows。Linux/macOS 校验及打包工作流已配置，实际成功状态以远端 Actions 为准；本地不能代替这两个平台的安装验收。真实 Electron 桌面端到端测试当前仅在 Windows 执行。
- 原生保存/关闭对话框在桌面测试中提供确定的返回值；文件写入、preload、窗口关闭和重启仍走真实应用链路。模型请求使用本地 HTTP/SSE 服务。
- 进程中断恢复测试覆盖真实子进程退出，不代表已经验证断电、硬件缓存损坏或所有网络盘语义。
- 队列提交后、请求发出前发生进程崩溃时不会自动重发；本轮不实现网络请求的崩溃后恰好一次执行。
- API Key 的本地明文存储和备份附件仅保留引用的设计保持不变；备份默认不含密钥，用户可显式勾选。

# Pointer 架构

本文以当前实现为基准描述系统结构；文中出现的数量与行为都可以在代码中直接核对。

## 一、分层与所有权

| 层     | 目录                   | 职责                                                                                 | 约束                                         |
| ------ | ---------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------- |
| 领域   | `src/shared/domain`    | 实体、不变量与算法：消息树、页面树、磁盘布局、`.pointer.md` 编解码、导入器、搜索匹配 | 纯 TypeScript，零副作用，不依赖 Electron/IO  |
| 契约   | `src/shared/contracts` | `RuntimePort`（query / command / subscribe）与 Query、Command、Event 三张映射表      | 命令与查询中不出现文件路径、文件名或平台差异 |
| 内核   | `src/main/runtime`     | 系统唯一事实源：持久化、SQLite 索引、会话、AI 流式、检索、附件、消息队列、设置       | 绝对路径只在此层产生                         |
| 展示层 | `src/renderer/src`     | React 界面，持有视图状态与一份内核状态镜像                                           | 不接触文件、路径或文件系统                   |
| 桥接   | `src/preload`          | 暴露 `window.runtime`、`window.electronWindow`、`window.shortcuts`                   | 渲染进程的唯一入口                           |

主进程入口 `src/main/index.ts` 只做四件事：创建窗口、装配内核（`RuntimeCore`）、接线 IPC（`src/main/ipc/runtimeIpc.ts`、`src/main/ipc/windowIpc.ts`）、退出时释放内核。对话框与系统集成通过 `RuntimeHost` 注入，内核本身不依赖 Electron 的交互 API。

## 二、数据流

```
UI → services/* → stores/* → runtime/client → 内核命令 → 内核事件 → 镜像 store → UI
```

- 写操作一律是命令；界面不预写本地状态，等内核回推事件后更新。
- 流式增量先合帧再写入 store：默认 80ms 一次，单条消息累计超过 3000 字符时放慢到 200ms，避免每个分片都触发 Markdown 重解析。
- 生成结束的消息进入关闭集合，迟到的分片被忽略，随后以内核的权威内容覆盖。
- `tree.changed` 时镜像层对齐页签（关闭指向已消失页面的页签、同步改名后的标题）并清理会话与队列缓存。
- `session.changed`（切换账户或工作区）时丢弃会话、队列、检索与聊天易失状态，再按新作用域重新查询。

页签、侧边栏宽度、展开状态等展示层状态由内核当作不透明文档持久化在 `view-state.json` 中，内核不解释其含义。

## 三、契约面

`RuntimePort` 只有三个方法：`query`、`command`、`subscribe`；对应 IPC 通道为 `runtime:query`、`runtime:command`、`runtime:event`。失败统一返回 `{ ok: false, code, message, details? }`，内核抛出携带稳定错误码的 `RuntimeError`。

当前规模：**14 个查询、53 个命令、15 个事件**。按用途分组：

- 查询：会话快照、账户与工作区列表、页面树、单个会话、设置、展示层状态、消息队列、工作区检索、模型目录与连接测试、附件内容、版本与更新状态。
- 命令：账户；工作区（创建、重命名、删除、路径校验与修复、打开文件管理器、选择目录）；页面树（页面与文件夹的增删改移、清空文件夹）；会话内容（增量追加、整体替换、消息补丁、批量补丁、删除、分支叶子与选中定位、Topic）；对话执行（发送、重新生成、继续、中止、生成标题、通用文本生成）；消息队列；设置与展示层状态整体替换；附件导入删除与对话框（保存文件、打开文本文件、选择图片）；第三方导入；更新（检查、下载、退出安装）。
- 事件：账户、会话、页面树、会话失效与单条消息、流式增量与终态（完成/失败/中止）、队列、设置、单页元数据、工作区外部改动、更新状态。会话级使用粗粒度失效通知，流式过程使用细粒度增量。

## 四、持久化

### 应用数据目录（`app.getPath('userData')`）

```
accounts.json          账户列表与当前账户
session.json           上次使用的账户与工作区
accounts/<accountId>/
  workspaces.json      该账户的工作区列表
  settings.json        账户级设置（LLM 配置、模型配置，API Key 以明文随配置保存）
  secrets.json         历史版本的加密密钥，仅作一次性迁移来源读取
workspaces/<accountId>/default/    默认工作区
```

### 工作区目录

```
<文件夹>/<页面>.pointer.md    页面文件：正文是 Markdown，元数据在 HTML 注释内的 XML 片段
.pointer/
  workspace.json              工作区身份
  folders.json                文件夹元数据（稳定 id 与排序）
  view-state.json             展示层状态（内核不解释）
  index.db                    SQLite 索引（派生数据，可重建）
  attachments/                附件
  queues/<pageId>.json        消息队列（每个会话一个文件）
```

- 磁盘布局是「文件夹元数据 + 页面元数据」的纯函数（`shared/domain/layout.ts`）：同样的数据必然得到同样的目录与文件名，外部改动后重新扫描即可对齐。
- 所有写盘都是原子写：临时文件 + fsync + rename。
- 页面文件里的 `<pointer-page>` 块是名称、星标、顺序、父文件夹的权威副本，元数据变更必须立即写回，否则下一次目录扫描会用磁盘上的旧值覆盖内存。
- 页面文件的存在性是页面存在性的真相，`.pointer/folders.json` 是文件夹元数据的真相。
- `index.db` 只承担索引职责：FTS5 虚拟表（`tokenize='trigram'`）加页面表；删除或损坏后重新扫描即可重建，用户数据始终在 `.pointer.md` 文件中。

## 五、外部改动与检索

- 打开工作区时用 `fs.watch`（recursive）监听，事件防抖后比对文件 mtime 与内存记录，变化的页面通过 `workspace.externalChange` 通知界面重读；索引只重新解析变化过的页面。
- 工作区检索先用索引缩小候选（正则模式或短查询走全量），再由领域层匹配器精确命中，因此大小写、整词、正则与高亮位置始终与用户输入一致。筛选条件为角色、时间范围与文件夹（含后代）。

## 六、领域模型要点

- **消息树**：同一父节点下 `branchIndex` 唯一并按它排序；`leafMessageId` 指向当前分支链路的终点，`selectedMessageId` 用于滚动定位；Topic 是同一路径上一段连续消息的命名分组。重新生成与继续都会在参照消息的父节点下创建新的分支。
- **页面树**：`validatePageTree` 校验 id 唯一、父节点存在、无环、同级名称唯一（名称比较键为 NFC + trim + 小写）。删除文件夹支持「提升子节点」与「级联删除」两种语义。
- **页面文件**：只接受 `version="2"` 的 `<pointer-page>` / `<pointer-message>` 标签，消息正文以 `<!-- [POINTER-MSG] -->` 分隔，思考内容包在 `<details>` 中；旧版本标签写出的文件会被判为缺少页面块，扫描时跳过。
- **导入器**：`openai`（ChatGPT 导出）、`deepseek`、`pointer` 三种格式，导入时保持原有顺序。
- **消息队列**：按 order 依次发送，暂停时不出队；队列属于会话。

## 七、会话执行

- `providers.ts` 只实现 OpenAI 兼容协议（`POST /chat/completions`、`GET /models`），协议差异全部收敛在此文件；流式解析用 `eventsource-parser`，同时识别 `reasoning_content` 与 `reasoning` 的思考内容。
- 上下文取当前分支路径（`pathToMessage`），跳过内容为空的助手消息；图片附件按 data URL 内联（非图片附件不进入请求）。系统提示词来自模型配置。
- 落盘时机：流式过程中不写盘；用户消息立即落盘，助手消息在终态（完成/中止/失败）落盘一次。
- 中止有两种粒度：按 `requestId`，或按 `pageId` 中止该页面当前的请求（覆盖内核侧发起的生成，例如消息队列自动发送）。
- 请求启动前失败时，失败原因会写入一条助手消息（标记 `hasError`），界面同时收到 `chat.failed`。
- 会话空闲时消息队列自动出队发送。
- 切换账户或工作区前，内核先中止全部生成并等待收尾落盘，避免收尾写入新打开的上下文。

## 八、验证

```bash
pnpm lint          # ESLint（warning 也视为失败）
pnpm typecheck     # 主进程 + 渲染进程类型检查
pnpm test          # 14 个测试文件、116 个用例（领域层 + 镜像层契约）
pnpm smoke:kernel  # 在临时目录启动完整内核，验证查询/命令/事件链路，共 22 项检查
pnpm build         # 类型检查 + electron-vite 构建
```

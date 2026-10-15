# 自动更新使用指南

## 功能概述

自动更新基于 `electron-updater` 实现，更新源是 GitHub Releases，包含：

- 应用启动 3 秒后自动检查一次更新（可在设置中关闭）
- 在设置里手动检查更新
- 由用户触发下载，下载过程中显示进度
- 下载完成后一键安装并重启
- 检查失败、下载失败以通知形式提示

## 界面与操作

### 入口

- 设置 →「关于」页签 →「应用更新」区块
- 全局通知与下载进度（右下角），由 `UpdateNotification` 渲染

### 启动时自动检查

启动后 3 秒发起一次检查；失败只在控制台记录，不会打扰用户。关闭「自动检查更新」开关后不再自动检查，手动检查仍然可用。

### 手动检查

1. 打开设置
2. 切到「关于」页签
3. 在「应用更新」区块点击「检查更新」
4. 结果以消息提示：`当前已是最新版本` 或 `发现新版本 <版本号>`

检查有 30 秒超时保护，超时按失败处理。

### 下载与安装

| 阶段       | 界面表现                                                                         |
| ---------- | -------------------------------------------------------------------------------- |
| 发现新版本 | 常驻通知「发现新版本」+ 版本号 +「下载更新」按钮；「关于」页同时出现「下载更新」 |
| 下载中     | 右下角环形进度（百分比）；「关于」页显示传输量、总大小与速度                     |
| 下载完成   | 通知「更新已下载」+「立即重启」；「关于」页出现「安装并重启」                    |
| 出错       | 通知「更新失败」+ 错误信息；「关于」页显示可关闭的错误 Alert                     |

点击「安装并重启」会弹出二次确认，提示应用将关闭并安装更新后自动重启。

当前没有「稍后提醒 / 稍后安装」按钮：关闭通知即视为忽略，之后可以在「关于」页重新检查或下载。下载由用户手动触发，应用不会自动下载更新包。

### 当前展示的信息

界面只展示**新版本号**与**下载进度**。发布名称、发布日期与详细更新说明尚未接入：内核推送的 `app.updateStatus` 事件只携带 `state`、`version`、`percent`、`message` 四个字段。

## 设置选项

- **当前版本**：以蓝色徽章展示
- **自动检查更新**：账户级设置，保存在该账户 `settings.json` 的 `autoCheckUpdate` 字段；关闭后仍可手动检查
- **更新状态**：检查中、发现新版本、下载中、已下载、错误（含错误信息）

## 技术实现

### 命令与事件

渲染进程通过内核命令发起操作，状态由内核事件回推：

| 命令                 | 作用                                     |
| -------------------- | ---------------------------------------- |
| `app.checkUpdate`    | 检查更新，返回 `{ available, version? }` |
| `app.downloadUpdate` | 开始下载                                 |
| `app.quitAndInstall` | 退出并安装                               |

事件 `app.updateStatus` 的负载为 `{ state, version?, percent?, message? }`，其中 `state` 取 `idle` / `checking` / `available` / `downloading` / `downloaded` / `error`。

查询 `app.version` 返回当前版本号，查询 `app.updateStatus` 返回当前更新状态。

相关文件：`src/main/autoUpdater.ts`（主进程）、`src/main/runtime/RuntimeCore.ts`（命令分发与状态广播）、`src/renderer/src/components/common/UpdateNotification.tsx`、`src/renderer/src/components/editors/SettingsEditor/AboutPanel.tsx`。

### 主进程行为

- `autoDownload = false`：下载必须由用户触发；`autoInstallOnAppQuit = true`
- 开发环境（`is.dev`）读取 `dev-app-update.yml`，并设置 `forceDevUpdateConfig = true`、`allowDowngrade = true`
- 因为开发环境下 `allowDowngrade` 会让更低版本也触发 `update-available`，内核用 `isNewerVersion` 过滤，只上报真正更新的版本；`checkForUpdates` 的返回值也会再判断一次，避免误报
- 事件映射：`update-available` → `available`，`download-progress` → `downloading(percent)`，`update-downloaded` → `downloaded`，`error` → `error`，`update-not-available` → `idle`

### 更新源与构建配置

```yaml
# dev-app-update.yml（开发环境）
provider: github
owner: experdot
repo: pointer
updaterCacheDirName: pointer-updater
allowDowngrade: true
```

```yaml
# electron-builder.yml（打包与发布）
publish:
  provider: github
  owner: experdot
  repo: pointer
```

## 安全说明（当前状态）

- 传输走 HTTPS（GitHub Releases）。
- **开发环境会跳过签名校验**，来源有三处：`dev-app-update.yml` 中 `publisherName` 被注释掉且 `allowDowngrade: true`；`autoUpdater.ts` 在 `is.dev` 时设置 `updateConfigPath` / `forceDevUpdateConfig` / `allowDowngrade`；`electron-builder.yml` 中 `verifyUpdateCodeSignature: false`。
- 因此"更新包会自动验证数字签名"当前并不成立，它只是启用正式签名后的目标行为。生产签名配置与恢复签名校验的注意事项见 [code-signing-guide.md](code-signing-guide.md)。
- 安装前有二次确认弹窗，并提示保存当前工作。

## 发布流程

1. 更新 `package.json` 的版本号（`pnpm version patch|minor|major`）
2. `pnpm release`：构建并发布到 GitHub Releases（`electron-builder --publish=always`）
3. 也可以推送 `v*` tag，由 `.github/workflows/release.yml` 构建并发布。该工作流的构建矩阵当前只有 `windows-latest`
4. 产物名为 `pointer-<版本>-setup.exe`（来自 `nsis.artifactName: ${name}-${version}-setup.${ext}`），同时生成 `latest.yml` 与 `.blockmap` 供自动更新使用
5. `pnpm release:draft` 只构建不发布，用于发布前验证

macOS 与 Linux 产物需要本地执行 `pnpm build:mac` / `pnpm build:linux`，尚未纳入自动发布。

## 故障排除

- **检查更新失败**：确认网络可达 GitHub；错误信息会出现在通知与「关于」页的错误 Alert 中，控制台会记录 `Update error`
- **下载失败**：重新点击「下载更新」；必要时清理 `pointer-updater` 更新缓存目录后重试
- **安装失败**：确认应用有足够权限，临时关闭杀毒软件干扰，或手动下载安装包覆盖安装
- **开发环境提示有新版本但版本号更低**：这是 `allowDowngrade` 的副作用，已被 `isNewerVersion` 过滤，以界面上报的版本号为准

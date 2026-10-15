# Windows 代码签名配置指南

## 问题说明

遇到下面的错误，说明需要配置代码签名：

```
New version X.X.X is not signed by the application owner: publisherNames: experdot
Status: 2
StatusMessage: The file is not digitally signed
```

## 方案一：开发/测试环境——当前已跳过签名校验

**适用场景**：开发、测试阶段。

仓库中与"跳过签名校验"相关的配置共三处，另有一处与打包范围有关：

| 位置                      | 具体配置                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `dev-app-update.yml`      | `publisherName` 被注释掉，并设置 `allowDowngrade: true`                                                              |
| `src/main/autoUpdater.ts` | `is.dev` 时设置 `updateConfigPath` 指向 `dev-app-update.yml`、`forceDevUpdateConfig = true`、`allowDowngrade = true` |
| `electron-builder.yml`    | `win.verifyUpdateCodeSignature: false`                                                                               |
| `electron-builder.yml`    | `files` 排除列表包含 `dev-app-update.yml`，因此它不会被打进安装包                                                    |

**使用方法**：

1. 确保在开发环境中运行应用
2. 应用会自动使用 `dev-app-update.yml` 作为更新配置
3. 自动更新检查与下载将跳过签名校验

`allowDowngrade` 会让更低版本也触发 `update-available`，内核已用 `isNewerVersion` 过滤，只上报真正更新的版本。以上配置只适用于开发/测试，不要用于正式发布。

## 方案二：生产环境——配置真实代码签名

**适用场景**：正式发布。

### 步骤 1：获取代码签名证书

- **购买证书**（推荐）：DigiCert、Sectigo（原 Comodo）、GlobalSign，价格通常在 $100-500/年
- **自签名证书**：只能用于测试，用户会看到安全警告，且无法通过更新包的签名校验

### 步骤 2：在 `electron-builder.yml` 中配置证书

取消注释并配置文件里预留的 `win` 段：

```yaml
win:
  executableName: pointer
  certificateFile: path/to/your-certificate.p12 # 证书文件路径
  certificatePassword: ${env.WIN_CSC_KEY_PASSWORD} # 证书密码
  certificateSubjectName: 'Your Company Name' # 证书主题名称
  sign: true
  signingHashAlgorithms: ['sha256']
  timestampServer: 'http://timestamp.digicert.com'
```

### 步骤 3：设置环境变量

```powershell
# Windows PowerShell
$env:WIN_CSC_KEY_PASSWORD="your-certificate-password"
```

### 步骤 4：同步恢复签名校验

启用正式签名后，必须同时把下面两项恢复，否则更新包签名依然不会被校验：

1. 把 `electron-builder.yml` 中 `win.verifyUpdateCodeSignature` 从 `false` 改回 `true`（或移除该行）
2. 在发布使用的更新配置里启用 `publisherName`（当前只有 `dev-app-update.yml` 中出现，且处于注释状态）

### 步骤 5（可选）：在 CI 中注入证书

仓库当前的发布工作流**未接入**这一步，`.github/workflows/release.yml` 只在 `windows-latest` 上构建并发布。若要在 CI 中签名，需要自行添加类似步骤：

```yaml
# .github/workflows/release.yml
- name: Setup code signing
  run: |
    echo "${{ secrets.WIN_CERTIFICATE }}" | base64 --decode > certificate.p12
  env:
    WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

## 方案三：创建自签名证书（仅用于测试）

```powershell
# 创建自签名证书
New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Your Name" -KeyUsage DigitalSignature -FriendlyName "Code Signing" -CertStoreLocation Cert:\CurrentUser\My

# 导出证书
$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object {$_.Subject -match "Your Name"}
$pwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -cert $cert -FilePath "certificate.p12" -Password $pwd
```

## 重要提醒

### 开发环境

- 当前配置已经跳过签名校验，可以正常进行自动更新测试
- 用户可能会看到系统安全警告

### 生产环境

- 必须配置真实的代码签名证书
- 自签名证书会导致用户看到安全警告，并且无法通过更新包的签名校验
- 启用签名后务必同步恢复 `verifyUpdateCodeSignature` 与 `publisherName`

## 测试验证

1. **构建应用**：

```bash
pnpm run build:win
```

2. **检查签名**：

```powershell
Get-AuthenticodeSignature "dist\pointer-<版本>-setup.exe"
```

产物命名来自 `electron-builder.yml` 的 `nsis.artifactName: ${name}-${version}-setup.${ext}`，当前版本（2.0.0-preview.1）对应 `dist\pointer-2.0.0-preview.1-setup.exe`。

3. **发布测试**：

```bash
pnpm run release
```

## 故障排除

### 常见错误

1. **证书路径错误**：确保证书文件路径正确
2. **密码错误**：检查环境变量 `WIN_CSC_KEY_PASSWORD`
3. **证书过期**：检查证书有效期
4. **权限问题**：确保构建环境有访问证书的权限
5. **签名后更新仍报未签名**：检查是否已恢复 `verifyUpdateCodeSignature` 与 `publisherName`

### 验证签名

```powershell
# 检查文件签名状态
Get-AuthenticodeSignature "your-app.exe" | Format-List

# 检查证书详情
Get-PfxCertificate -FilePath "certificate.p12"
```

## 总结

- **当前状态**：开发环境已跳过签名校验
- **短期方案**：继续使用当前配置进行开发测试
- **长期方案**：购买并配置正式代码签名证书，并同步恢复签名校验
- **用户体验**：正式签名证书能提供最佳的用户信任度

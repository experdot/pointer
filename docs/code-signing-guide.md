# Windows 代码签名配置指南

## 问题说明

当您遇到以下错误时，说明需要配置代码签名：

```
New version X.X.X is not signed by the application owner: publisherNames: experdot
Status: 2
StatusMessage: The file is not digitally signed
```

## 解决方案

### 方案一：开发/测试环境 - 跳过签名验证

**适用场景**：开发、测试阶段

**已配置项目**：

- `dev-app-update.yml` 中注释了 `publisherName`
- 主进程中添加了 `allowDowngrade: true`

**使用方法**：

1. 确保在开发环境中运行应用
2. 应用会自动使用 `dev-app-update.yml` 配置
3. 更新时将跳过签名验证

### 方案二：生产环境 - 配置真实代码签名

**适用场景**：正式发布

#### 步骤1：获取代码签名证书

1. **购买证书**（推荐）：
   - DigiCert
   - Sectigo (原 Comodo)
   - GlobalSign
   - 价格通常在 $100-500/年

2. **免费证书**（测试用）：
   - 可以创建自签名证书，但用户会看到安全警告

#### 步骤2：配置证书

在 `electron-builder.yml` 中取消注释并配置：

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

#### 步骤3：设置环境变量

```bash
# Windows PowerShell
$env:WIN_CSC_KEY_PASSWORD="your-certificate-password"

# 或在 GitHub Actions 中设置 secrets
# WIN_CSC_KEY_PASSWORD
```

#### 步骤4：更新构建脚本

如果使用 GitHub Actions，需要上传证书文件或使用加密的证书：

```yaml
# .github/workflows/release.yml
- name: Setup code signing
  run: |
    echo "${{ secrets.WIN_CERTIFICATE }}" | base64 --decode > certificate.p12
  env:
    WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

### 方案三：创建自签名证书（仅用于测试）

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

- ✅ 当前配置已经跳过签名验证
- ✅ 可以正常进行自动更新测试
- ⚠️ 用户可能会看到安全警告

### 生产环境

- ❌ 必须配置真实的代码签名证书
- ❌ 自签名证书会导致用户看到安全警告
- ✅ 正式证书提供最佳用户体验

## 测试验证

1. **构建应用**：

```bash
pnpm run build:win
```

2. **检查签名**：

```powershell
Get-AuthenticodeSignature "dist\pointer-1.0.0-preview.8-setup.exe"
```

3. **发布测试**：

```bash
pnpm run release
```

## 故障排除

### 常见错误

1. **证书路径错误**：确保证书文件路径正确
2. **密码错误**：检查环境变量中的证书密码
3. **证书过期**：检查证书有效期
4. **权限问题**：确保构建环境有访问证书的权限

### 验证签名

```powershell
# 检查文件签名状态
Get-AuthenticodeSignature "your-app.exe" | Format-List

# 检查证书详情
Get-PfxCertificate -FilePath "certificate.p12"
```

## 总结

- **当前状态**：已配置开发环境跳过签名验证
- **短期方案**：继续使用当前配置进行开发测试
- **长期方案**：购买并配置正式代码签名证书
- **用户体验**：正式签名证书能提供最佳的用户信任度

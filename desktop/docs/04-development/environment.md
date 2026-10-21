# 开发环境

> 状态：已生效 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[快速开始](getting-started.md) · [构建与发布](../06-release/build.md)

---

## 1. 工具链版本

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Go | 1.22+ | `go.mod` 中 `go 1.22`；使用 `slices`/`maps` 标准库 |
| Node.js | 20 LTS+ | 前端构建 |
| npm | 10+ | 使用 `npm ci` 保证锁文件一致 |
| Wails CLI | v2.8+ | 与 `go.mod` 中 `github.com/wailsapp/wails/v2` 版本对齐 |
| Git | 2.40+ | — |
| golangci-lint | 1.59+（可选） | 本地预检 |

版本变更必须同时更新本文与 CI 配置。

## 2. 平台依赖

### Windows

| 依赖 | 说明 |
| --- | --- |
| WebView2 Runtime | Win10 1809+ 通常已装；未装需安装 Evergreen Bootstrapper |
| MSVC / Build Tools | 若使用 CGO 版 SQLite 驱动则需要；纯 Go 驱动不需要 |
| GPG（可选） | 签名发布包 |

```powershell
# 检查
wails doctor
# 若 WebView2 缺失
winget install Microsoft.EdgeWebView2Runtime
```

### macOS

| 依赖 | 说明 |
| --- | --- |
| Xcode Command Line Tools | `xcode-select --install` |
| WKWebView | 系统自带 |
| 签名证书（发布用） | Developer ID Application |

```bash
xcode-select -p        # 应输出 /Applications/Xcode.app/... 或 /Library/Developer/CommandLineTools
```

## 3. 环境变量

| 变量 | 用途 | 示例 |
| --- | --- | --- |
| `OMNIMAIL_DATA_DIR` | 覆盖数据目录 | `D:\omnimail-dev` |
| `OMNIMAIL_LOG_LEVEL` | 日志级别 | `debug` |
| `OMNIMAIL_IMAP_DEBUG` | 打印 IMAP 协议帧（含脱敏） | `1` |
| `OMNIMAIL_SMTP_HOST` | 测试用 SMTP 覆盖 | `127.0.0.1:1025` |

> 生产构建不会读取这些变量中的敏感覆盖项（仅 `OMNIMAIL_LOG_LEVEL` 与 `OMNIMAIL_DATA_DIR` 生效）。

## 4. 本地测试服务器

开发时不要用真实邮箱做自动化测试。使用本地假服务：

```bash
# IMAP：greenmail 或 dovecot 容器
docker run -d --name imap-test -p 3143:3143 -p 3993:3993 \
  greenmail/standalone:2.0.0

# SMTP：MailHog（Web 界面 http://localhost:8025）
docker run -d --name mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

配置示例（`config.json` 片段）：

```json
{
  "imap": { "host": "127.0.0.1", "port": 3143, "security": "none" },
  "smtp": { "host": "127.0.0.1", "port": 1025, "security": "none" }
}
```

## 5. 开发数据目录隔离

开发时用独立目录，避免污染真实数据：

```powershell
$env:OMNIMAIL_DATA_DIR = "D:\omnimail-dev"
wails dev
```

```bash
export OMNIMAIL_DATA_DIR="$HOME/omnimail-dev"
wails dev
```

## 6. IDE 建议

### VS Code 扩展

- Go（官方）
- ESLint
- Prettier
- Error Lens
- Markdown All in One（文档）

### 设置要点

```json
{
  "go.useLanguageServer": true,
  "[go]": { "editor.formatOnSave": true, "editor.codeActionsOnSave": { "source.organizeImports": "explicit" } },
  "[typescript][typescriptreact]": { "editor.formatOnSave": true, "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "typescript.tsdk": "frontend/node_modules/typescript/lib"
}
```

## 7. 常见环境问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `wails: command not found` | GOPATH/bin 不在 PATH | 将 `%USERPROFILE%\go\bin` 或 `$HOME/go/bin` 加入 PATH |
| `failed to build: exit status 1` 且提到 webview2 | WebView2 SDK 缺失 | `wails dev` 会自动下载；检查网络代理 |
| `npm ci` 报锁文件不一致 | package-lock 被改 | 还原 `package-lock.json`，或本地 `npm install` 后提交 |
| CGO 相关编译错误 | 驱动或平台库需要 CGO | 确认 `CGO_ENABLED=1` 与编译器存在，或改用纯 Go 驱动（待 ADR） |
| 端口被占用（前端 34115） | 上次进程未退出 | 结束残留进程 |

更多见 [故障排查](troubleshooting/README.md)。

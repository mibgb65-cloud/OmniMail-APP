# 开发环境

> 状态：已生效 | 负责人：@backend-lead | 最后更新：2026-10-24
> 相关：[快速开始](getting-started.md) · [构建与发布](../06-release/build.md)

本文以现有锁定依赖和任务配置为准。

## 1. 工具链

| 工具 | 要求 | 来源 |
| --- | --- | --- |
| Go | 1.26.0+ | `desktop/go.mod` |
| Node.js | `^22.13.0 \|\| ^24.0.0 \|\| >=26.0.0` | `frontend/package.json` 的 `engines` |
| npm | 10+ | 使用 `npm ci` 安装锁定依赖 |
| Wails | `v3.0.0-beta.34` | Go 运行库与 CLI 使用同一版本；前端 runtime 版本一致 |
| Task | 无需单独安装 | 通过 `go tool wails3 task` 调用 |
| Git | 需可用 | 构建任务读取当前提交号 |

当前 Windows 验证环境：Go 1.26.2、Node.js 22.19.0、npm 10.9.3。Wails v3 为预发布版本，升级必须单独验证绑定与原生窗口行为。

## 2. 平台依赖

### Windows

当前工程使用 WebView2，已在 `windows/amd64`、`CGO_ENABLED=0` 环境验证开发依赖。安装包工具与签名工具不属于本地开发前置要求。

在 `desktop/` 执行：

```powershell
go tool wails3 doctor
```

如报告缺少 WebView2，可安装后重新检查：

```powershell
winget install Microsoft.EdgeWebView2Runtime
```

### macOS

使用系统 WKWebView，并准备 Xcode Command Line Tools：

```bash
xcode-select -p
# 尚未安装时执行
xcode-select --install
```

macOS 原生构建与运行尚未在本次 Windows 环境验证。发布证书、公证和安装包配置仍待实现。

## 3. 环境变量与本地数据

| 变量 | 当前行为 |
| --- | --- |
| `OMNIMAIL_DATA_DIR` | 指定普通绝对路径，不能是磁盘根目录；拒绝控制字符、超长路径和 Windows 设备路径 |
| `OMNIMAIL_LOG_LEVEL` | 默认 `info`；支持 `debug`、`info`、`warn`、`error` |

`task dev` 未收到目录覆盖时默认使用 `desktop/.devdata/`。直接运行构建产物时，默认数据目录为 `os.UserConfigDir()/OmniMail`：Windows 为 `%APPDATA%\OmniMail`，macOS 为 `~/Library/Application Support/OmniMail`。

日志写入数据目录下的 `logs/app-YYYY-MM-DD.log`，按天轮转并脱敏。当前只创建日志目录，尚未加载配置文件、创建数据库或接入 IMAP/SMTP；协议调试环境变量、测试邮箱服务器和配置文件格式尚未实现。

## 4. 依赖与端口

- Go 依赖由 `go.mod` / `go.sum` 锁定，前端依赖由 `package-lock.json` 锁定。
- 在 `desktop/` 执行 `go tool wails3 task setup`，安装依赖并生成绑定。
- Vite 监听 `127.0.0.1:9245`；开发编排在 `build/config.yml` 中固定使用 9245。仅修改 `WAILS_VITE_PORT` 不会同步修改编排配置。
- 当前无需 `.env`、邮箱密码、OAuth 令牌或数据库服务即可启动。

IDE 从仓库根目录打开时，Go module 位于 `desktop/`，TypeScript SDK 位于 `desktop/frontend/node_modules/typescript/lib`。Android / iOS 目录尚无工程，不能按本页命令运行。

# 构建与发版打包

## 准备工具

本项目基于 Wails v3 + Go + React + TypeScript（零 CGO，`CGO_ENABLED=0`），支持 64 位 Windows 10/11。安装 Go 1.26、`.nvmrc` 中的 Node.js 版本及 NSIS 3.x（`makensis.exe`）后，在 PowerShell 中准备开发工具：

```powershell
npm install -g pnpm@12.6.0
go install github.com/go-task/task/v3/cmd/task@v3.53.1
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.1.0
wails3 doctor
```

确保 Go 工具安装目录（`GOBIN` 或 `GOPATH\bin`）在 `PATH` 中，且系统已安装 Microsoft Edge WebView2 Runtime。

## 日常开发与质量验证命令

从仓库根目录执行：

```powershell
task setup       # 安装锁定的 Go 模块与前端依赖
task dev         # 启动原生桌面窗口与 Vite 热更新，Ctrl+C 停止
task build       # 单独构建开发版 EXE（desktop/bin/omnimail.exe），不启动窗口
task run         # 运行已构建的开发版 EXE
task verify      # 执行格式检查、Lint、TypeScript 检查、前端构建、前端与 Go 单测、go vet 与编译
```

## Windows x64 生产发版与三轨版本号体系

打包脚本 `desktop/build/windows/package-windows.ps1` 采用单一来源版本号注入，严格对齐环境分支与三轨版本规范：

| 对应分支 | 轨道 | 标签格式示例 | 输出安装包名 | 通道 (`ReleaseChannel`) | PE 四段版本 | 线上打包策略 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dev` | 本地开发版（Alpha） | `v1.2.0-alpha.1` | `OmniMail-windows-Setup-v1.2.0.alpha.1.exe` | `alpha` | `1.2.0.1` | **仅本地打包测试**，线上忽略不打包 |
| `test` | 测试预发版（Beta） | `v1.2.0-beta.1` | `OmniMail-windows-Setup-v1.2.0.beta.1.exe` | `beta` | `1.2.0.1` | 推送标签且提交属于 `test` 时自动发布 Pre-release |
| `prod` | 正式生产版（Stable） | `v1.2.0` | `OmniMail-windows-Setup-v1.2.0.exe` | `stable` | `1.2.0.0` | 推送标签且提交属于 `prod` 时自动发布 Latest Release |

### 一键本地打包命令

```powershell
# 1. 构建本地开发验证版（dev 分支本地自测，默认 v0.0.1-alpha.1）
task package:windows:alpha
task package:windows:alpha VERSION=v1.2.0-alpha.1

# 2. 构建 Beta 测试版（默认 v0.0.1-beta.1）
task package:windows:beta
task package:windows:beta VERSION=v1.2.0-beta.1

# 3. 构建正式生产版（默认 v0.0.1）
task package:windows:stable
task package:windows:stable VERSION=v1.2.0
```

### 5 步打包流水线与产物

1. 生成最新 Wails v3 TypeScript 绑定；
2. 执行前端 `tsc --noEmit` 与 Vite 生产压缩打包；
3. 动态生成临时 PE 版本描述并调用 `wails3 generate syso` 嵌入多尺寸图标与版本信息（构建后自动清理临时文件，不污染 Git 模板）；
4. 纯 Go 生产编译（`CGO_ENABLED=0`、`-tags production`、`-ldflags "-s -w -H windowsgui -X main.AppVersion=... -X main.ReleaseChannel=... -X main.BuildTime=..."`），并对内层主程序 `OmniMail.exe` 执行 `CN=OmniMail` Authenticode 代码签名与时间戳固化；
5. 调用 `makensis /WX`（零警告门禁）按版本号创建独立目录 `dist/release/<Version>/`，输出对应版本的 Unicode High-DPI 交互式安装向导（`LZMA /SOLID`），先对安装包执行 `CN=OmniMail` 数字签名（公开验证证书位于 `desktop/build/windows/OmniMail-CodeSigning.cer`），再计算最终 `SHA256SUMS.txt`。

每次发版均输出至对应版本名的独立目录 `dist/release/<Version>/`（例如 `dist/release/v0.0.1/` 或 `dist/release/v1.2.0-beta.1/`）：

- `OmniMail-windows-Setup-vX.Y.Z.exe`（或 `.beta.N.exe` / `.alpha.N.exe`）：NSIS 交互式安装包（含 Windows 10/11 x64 检测、WebView2 Runtime 检测、运行中托盘实例温和退出保护、[LICENSE](../../LICENSE) 开源协议页、当前用户/所有用户模式、程序目录与本地空间数据目录分离校验、可选开机自启与 `--silent-tray` 静默托盘驻留、安全注册 `mailto:` / `.eml` / `.ics` 默认邮件客户端能力，以及默认保留本地数据的安全卸载页）。
- `SHA256SUMS.txt`：该版本安装包 `.exe` 的 SHA-256 校验值。

### 自动化与企业静默部署参数

安装向导支持标准静默与路径覆盖参数：

```powershell
OmniMail-windows-Setup-v0.0.1.exe /S /CurrentUser /INSTDIR="C:\Apps\OmniMail" /DATADIR="D:\OmniMailData"
```

## 常见问题

- 只想在浏览器预览前端界面：先运行 `task setup` 和 `task bindings`，再运行 `pnpm --dir desktop/frontend dev`。
- Go 提示 `frontend/dist` 不存在：先运行 `task build` 或 `task test`，避免在干净检出时直接裸跑 `go build`。
- 前端找不到绑定：运行 `task bindings`（`desktop/frontend/bindings/` 由 Wails 自动生成，不手改）。

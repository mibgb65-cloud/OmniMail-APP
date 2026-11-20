# OmniMail

OmniMail 是一个处于初始化阶段的桌面邮件项目。当前版本提供 Wails 原生窗口和 React 界面，用于验证桌面前后端连接；尚未接入邮箱。

## 快速开始（Windows）

需要 Go 1.26、Node.js 22.19.0、pnpm 12.6.0、Task 3.53.1、Wails CLI 3.1.0 和 WebView2。安装方式见[构建与启动](docs/development/BUILD.md)。

在仓库根目录运行：

```powershell
task setup
task dev
```

- `task verify`：安装锁定依赖，执行格式检查、Lint、类型检查、测试和开发构建。
- `task build`：仅生成开发版 `desktop/bin/omnimail.exe`，不启动，也不生成安装包。
- `task run`：运行已有的开发版 EXE，使用内嵌前端，不带热更新。

## 项目入口

- `desktop/`：Go 入口、Wails 配置及服务。
- `desktop/frontend/`：React、TypeScript 和 Vite。
- [文档索引](docs/README.md)：产品、架构、开发与任务流程。
- [AGENTS.md](AGENTS.md)：协作与验证规则。

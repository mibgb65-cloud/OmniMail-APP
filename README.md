# OmniMail

> 状态：开发中 | 最后更新：2026-10-25

本地优先的邮件客户端，当前实现为 **Wails v3 + Go + React + TypeScript 桌面工程骨架**。

## AI 协作入口

AI 开发先读根目录 [AGENTS.md](AGENTS.md)。所有修改类任务先创建或更新
[任务记录](desktop/docs/07-tasks/README.md)，按分析、计划、实现、验证、文档和授权 Git 处置的流程交付。
当前任务概览见[进行中任务索引](desktop/docs/07-tasks/active/README.md)；没有提交授权时不自动提交或归档。

## 当前进度

- 已实现：桌面窗口、单实例、版本桥接、配置与日志、SQLite 账号/邮件缓存；应用授权码账号添加、TLS IMAP/SMTP 认证、系统凭据适配、后台轮询及手动同步、纯文本发送、正文和附件缓存/查看/另存，前后端关键路径测试。
- 尚未实现：Gmail/Outlook OAuth 客户端授权、IMAP IDLE、草稿自动保存/离线发件队列、发送附件、完整全文检索、缓存定额与垃圾回收、托盘与通知、CI、安装包与签名。
- 验证边界：Windows 凭据原生读写已验证，邮件协议在本地 TLS 服务验证；未使用真实服务商账号，不代表所有服务商兼容性或 macOS 实机已通过。仅在用户主动添加账号后连接其服务器。
- `android/`、`ios/`、根目录 `docs/` 为预留目录，暂无独立应用或跨端实现。

现有工程使用 `desktop/go.mod` 固定的 Wails v3 版本。早期文档采用 Wails v2，历史决策与后续设计的差异见 [ADR-0001](desktop/docs/02-architecture/adr/ADR-0001-tech-stack.md)。开发命令以本页和[快速开始](desktop/docs/04-development/getting-started.md)为准。

## 启动桌面端

准备 Go 1.26.0+、Node.js 22.13+（22 系列）或 24 系列、npm 10+；Windows 需要 WebView2，macOS 需要 Xcode Command Line Tools。完整要求见[开发环境](desktop/docs/04-development/environment.md)。

在仓库根目录执行：

```powershell
cd desktop
go tool wails3 task setup
go tool wails3 doctor
go tool wails3 task dev
```

首次安装需要联网。CLI 与运行库由 `go.mod` 锁定，无需全局安装 `wails`、`wails3` 或 `task`。

启动后应看到初始化工作台，以及从 Go 获取的版本、提交、构建时间与平台信息。开发数据默认位于 `desktop/.devdata/`，日志位于其 `logs/app-YYYY-MM-DD.log`。

单独运行 `npm run dev` 只提供浏览器预览，不能验证 React 与 Go 的连接。

## 检查与构建

以下命令均在 `desktop/` 执行：

```powershell
go tool wails3 task verify
go tool wails3 task build
go tool wails3 task run
```

`verify` 是完整质量门禁，验证产物位于 `desktop/.task/verify-bin/`，不会覆盖正在运行的桌面程序。
`check` 可单独执行不含构建的检查；常规 `build` 仍生成 `desktop/bin/OmniMail.exe`（Windows），供 `run` 启动。
安装包、签名与跨平台发布仍待实现。

## 文档入口

- [桌面端文档中心](desktop/docs/README.md)
- [快速开始](desktop/docs/04-development/getting-started.md)
- [工程结构](desktop/docs/04-development/project-structure.md)
- [工程骨架验收记录](desktop/docs/07-tasks/active/TASK-0002-project-skeleton.md)

构建产物、依赖、日志与本地数据均由 `.gitignore` 排除。凭据和真实邮件不得提交到仓库。

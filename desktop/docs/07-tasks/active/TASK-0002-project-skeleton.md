# TASK-0002 工程骨架：Wails 启动 + 绑定打通

> 状态：进行中 | 最后更新：2026-10-24
> 负责人：@backend-lead | 创建：2026-10-15 | 预计：3 天 | 优先级：P0
> 关联：[roadmap M0](../../01-product/roadmap.md#m0-骨架) · [ADR-0001](../../02-architecture/adr/ADR-0001-tech-stack.md) · [工程结构](../../04-development/project-structure.md)

## 目标

在 `desktop/` 执行 `go tool wails3 task dev` 能启动可见窗口，前端调用一次 Go 方法并显示返回值；`go tool wails3 task build` 产物可独立运行。
完成后 M0 的"工程可跑通"出口达成。

现有骨架已使用 Wails v3.0.0-beta.34，本次保留既有实现；原 v2 选型记录与实现差异见 [ADR-0001](../../02-architecture/adr/ADR-0001-tech-stack.md)。Windows 本地初始化已验证，macOS 与正式技术栈评审仍待完成，因此任务保留在进行中。

## 范围

### 包含
- `desktop/main.go` 与 `internal/app` 装配（窗口、生命周期、单实例锁）
- `internal/bridge` 首个绑定方法 `App.Version()`
- `internal/config` 加载与校验（`OMNIMAIL_DATA_DIR` 支持）
- `internal/logger` 结构化日志 + 按天轮转 + 字段脱敏骨架
- 前端壳：`frontend/src/app` + 一个显示版本号的页面
- `Taskfile.yml`、`build/config.yml`、`tsconfig`、`vite` 配置
- `.gitignore` 完善

### 不包含
- 数据库、IMAP/SMTP、任何邮件功能（属后续任务）
- 托盘 / 通知 / 快捷键（平台层任务）

## 实现步骤

1. [x] Go module 与 Wails v3 依赖锁定；CLI 使用 Go tool 指令固定同版
2. [x] 实现 `config.Load`（默认值 + 环境变量 + 校验）
3. [x] 实现 `logger`（`slog` + 按天轮转 + 脱敏）
4. [x] `app.Run` 装配窗口与生命周期：启动记录版本与提交，退出关闭日志
5. [x] `bridge.AppBridge.Version()` 返回版本、提交、构建时间、Go 版本与平台
6. [x] 前端壳与 `lib/bridge` 封装，页面显示版本并支持错误重试
7. [x] 按数据目录区分单实例标识，重复启动恢复与聚焦已有窗口
8. [ ] 开发与独立构建双平台验证（Windows 已通过；macOS 待验证）

## 验收标准

- [x] Windows 开发模式启动窗口，页面显示 `0.1.0-dev`、当前 HEAD 提交与构建时间；Git tag 版本注入另待实现
- [x] `OMNIMAIL_DATA_DIR` 生效，日志写入该目录 `logs/app-YYYY-MM-DD.log`
- [x] 日志中 `email`/`password`/`token` 字段自动脱敏（有单测）
- [ ] 重复启动不产生第二实例，已有窗口聚焦（Windows 第二实例自动退出已验证；前台聚焦未确认）
- [ ] `go tool wails3 task build` Windows/macOS 产物可运行（Windows 独立运行与 React ↔ Go 连接通过；macOS 待验证）
- [x] `go vet . ./internal/...` 与 `gofmt -l main.go assets_dev.go assets_production.go internal` 无输出

## 风险与依赖

- Wails CLI 与 `go.mod` 版本不一致会导致生成代码漂移 -> 在 `go.mod` 注释锁定版本。
- macOS 首次启动可能被 Gatekeeper 拦截（未签名）-> 内部测试接受。

## 验证记录

| 日期 | 验证内容 | 结果 |
| --- | --- | --- |
| 2026-10-24 | `go tool wails3 task setup`、`go mod verify` | 锁定依赖安装、绑定重新生成与 Go 依赖校验通过；npm 安装审计报告 0 个漏洞 |
| 2026-10-24 | `go tool wails3 doctor` | Windows amd64 / Go 1.26.2 / Node.js 22.19.0 / npm 10.9.3；开发依赖检查通过 |
| 2026-10-24 | `go tool wails3 task check`、Go 格式检查 | Go vet、bridge/config/logger 测试通过；前端 lint、格式、类型检查及 20 个测试通过 |
| 2026-10-24 | `go tool wails3 task dev` 原生窗口截图核对 | 页面显示 React ↔ Go 连接成功、提交 `ee3d5d126fb8`、Go 1.26.2 与 windows/amd64；正常关窗退出 |
| 2026-10-24 | `go tool wails3 task build`、`go tool wails3 task run` | Windows 产物构建、无 Vite 时独立运行、React ↔ Go 连接与正常关闭均通过；安装包、签名和 macOS 未验证 |
| 2026-10-24 | 同数据目录重复启动产物 | 第二进程自动退出，原实例继续运行；自动检查未观察到原窗口成为前台窗口，聚焦验收保留未完成 |

## 完成记录

- 提交：本次未提交；开始检查时工程代码已在工作区，但尚未被 Git 跟踪。
- 2026-10-27 提交整理：用户授权按任务近似提交，允许累积界面依赖重叠；
  本次将提交现有工程及界面集成基线，不伪造 TASK-0004～0029、0031 的历史中间版本。
  SQLite 增量另属 TASK-0030；实际基线提交为 `b1c49ebe66c479ebdb6b5ea4724b4fe47e6a2033`。
  暂存快照在独立临时目录执行 `npm ci` 和完整 verify 通过，包含 257 项前端测试及 Windows 构建。
  此次 Git 处置不替代下方未完成的 macOS、聚焦和技术栈验收，任务仍保持进行中。
- 文档更新：根目录 README、快速开始、环境要求、工程结构、构建说明、ADR 实现差异与变更日志。
- 待完成：macOS 构建与运行、单实例聚焦验收、Wails v3 正式选型评审；CI 仍属独立 [TASK-0003](TASK-0003-ci-pipeline.md)。
- 归档日期：尚未归档，保留未完成的验收项。

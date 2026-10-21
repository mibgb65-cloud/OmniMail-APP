# TASK-0002 工程骨架：Wails 启动 + 绑定打通

> 状态：待开始
> 负责人：@backend-lead | 创建：2026-10-15 | 预计：3 天 | 优先级：P0
> 关联：[roadmap M0](../../01-product/roadmap.md#m0-骨架) · [ADR-0001](../../02-architecture/adr/ADR-0001-tech-stack.md) · [工程结构](../../04-development/project-structure.md)

## 目标

`wails dev` 能启动一个可见窗口，前端调用一次 Go 方法并显示返回值；`wails build` 产物可运行。
完成后 M0 的"工程可跑通"出口达成。

## 范围

### 包含
- `desktop/main.go` 与 `internal/app` 装配（窗口、生命周期、单实例锁）
- `internal/bridge` 首个绑定方法 `App.Version()`
- `internal/config` 加载与校验（`OMNIMAIL_DATA_DIR` 支持）
- `internal/logger` 结构化日志 + 按天轮转 + 字段脱敏骨架
- 前端壳：`frontend/src/app` + 一个显示版本号的页面
- `wails.json`、`tsconfig`、`vite` 配置
- `.gitignore` 完善

### 不包含
- 数据库、IMAP/SMTP、任何邮件功能（属后续任务）
- 托盘 / 通知 / 快捷键（平台层任务）

## 实现步骤

1. [ ] 初始化 Go module，接入 Wails v2 依赖并锁定版本
2. [ ] 实现 `config.Load`（默认值 + 环境变量 + 校验）
3. [ ] 实现 `logger`（`slog` + 轮转 + 脱敏 Hook）
4. [ ] `app.App` 结构：`startup` 打印版本与数据目录，`shutdown` 冲刷日志
5. [ ] `bridge.AppBridge.Version()` 返回 `{version, commit, buildTime}`
6. [ ] 前端壳与 `lib/bridge` 封装，页面显示版本
7. [ ] 配置单实例锁
8. [ ] 验证 `wails dev` 与 `wails build` 双平台

## 验收标准

- [ ] `wails dev` 启动窗口，前端显示 `vX.Y.Z (commit)`，与 `git describe` 一致
- [ ] `OMNIMAIL_DATA_DIR` 生效，日志文件写入该目录 `logs/app.log`
- [ ] 日志中 `email`/`password`/`token` 字段自动脱敏（有单测）
- [ ] 重复启动不产生第二实例，已有窗口聚焦
- [ ] `wails build -clean` Windows/macOS 产物可运行
- [ ] `go vet ./...` 与 `gofmt -l` 无输出

## 风险与依赖

- Wails CLI 与 `go.mod` 版本不一致会导致生成代码漂移 -> 在 `go.mod` 注释锁定版本。
- macOS 首次启动可能被 Gatekeeper 拦截（未签名）-> 内部测试接受。

## 验证记录

| 日期 | 验证内容 | 结果 |
| --- | --- | --- |
| — | — | — |

## 完成记录

- 提交：—
- 文档更新：—
- 归档日期：—

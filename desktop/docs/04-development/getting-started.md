# 快速开始

> 状态：已生效 | 负责人：@backend-lead | 最后更新：2026-10-24
> 相关：[工程结构](project-structure.md) · [环境要求](environment.md)

本文对应当前 Wails v3 工程骨架。邮箱、数据库、同步与发送功能属于后续实现。

## 1. 前置检查

```powershell
go version
node --version
npm --version
```

Go 版本至少为 `go.mod` 声明的 1.26.0；Node.js 需满足 `frontend/package.json` 的 `engines`。平台依赖与版本范围见[开发环境](environment.md)。

## 2. 安装依赖

在仓库根目录执行：

```powershell
cd desktop
go tool wails3 task setup
go tool wails3 doctor
```

`setup` 依次执行 `go mod download`、`npm ci` 与 TypeScript 绑定生成。首次执行需要联网。Wails CLI 已通过 Go tool 指令锁定，无需安装全局 CLI 或 Task；请勿使用旧版 `wails dev`。

## 3. 启动开发模式

安装完成后，保持工作目录为 `desktop/`：

```powershell
go tool wails3 task dev
```

- 打开桌面窗口；前端使用 Vite 热更新，Go 文件变更触发重新构建。
- 工作台显示“桌面服务已连接 · React ↔ Go”以及 Go 返回的版本信息。
- 当前版本为 `0.1.0-dev`，构建任务注入当前提交号与构建时间；尚未从 Git tag 推导版本。
- 开发数据默认隔离到 `desktop/.devdata/`，日志为 `logs/app-YYYY-MM-DD.log`；当前不会创建数据库或读取邮件。
- 按 `Ctrl+C` 停止开发任务。

如需自定义数据目录，启动前设置非磁盘根目录的绝对路径：

```powershell
$env:OMNIMAIL_DATA_DIR = 'D:\omnimail-dev'
go tool wails3 task dev
```

## 4. 检查与构建

以下命令均在 `desktop/` 执行：

| 目的 | 命令 |
| --- | --- |
| 后端静态检查与测试、前端完整检查 | `go tool wails3 task check` |
| 检查 Go 文件格式（应无输出） | `gofmt -l main.go assets_dev.go assets_production.go internal` |
| 校验 Go 依赖 | `go mod verify` |
| 重新生成绑定 | `go tool wails3 task bindings` |
| 构建当前平台可执行文件 | `go tool wails3 task build` |
| 运行构建产物 | `go tool wails3 task run` |

构建先生成绑定，再构建前端，最后通过 `production` 标签嵌入静态资源。Windows 输出为 `bin/OmniMail.exe`，不依赖 Vite；其他平台在对应系统上构建，macOS 尚待验证。安装包与签名见[构建与发布](../06-release/build.md)。

## 5. 常见问题

| 现象 | 排查方式 |
| --- | --- |
| 提示找不到 `go.mod` 或 `wails3` 工具 | 确认位于 `desktop/`，Go 至少为 1.26.0 |
| 浏览器中显示无法连接桌面服务 | 使用 `go tool wails3 task dev` 启动桌面应用；`npm run dev` 仅预览前端 |
| Vite 端口 9245 被占用 | 退出之前的开发进程后重试；开发配置固定使用该端口 |
| 配置校验失败 | 数据目录必须是普通绝对路径且不能是磁盘根目录；日志级别仅接受 `debug/info/warn/error` |
| Windows 启动失败 | 运行 `go tool wails3 doctor` 检查 WebView2；查看当前数据目录的按日日志 |

`frontend/bindings/` 为生成代码，勿手改；对外调用统一经过 `frontend/src/lib/bridge/`。分支与提交规则见 [Git 提交规范](../00-guidelines/git-conventions.md)。

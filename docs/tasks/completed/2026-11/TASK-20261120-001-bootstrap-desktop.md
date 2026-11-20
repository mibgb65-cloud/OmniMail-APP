# TASK-20261120-001：初始化 OmniMail 桌面项目

## 状态

Completed

## 需求

参考本地 OmniProxy，初始化 Wails v3 桌面项目、React 前端和 `docs/` 开发流程。

## 现状与范围

根目录已有 Git 仓库，`desktop/` 为空。桌面端使用该目录，文档和开发入口放在根目录。不复制 OmniProxy 的业务代码；本次不接入邮箱，不创建发布包。

## 方案取舍

采用官方模板加少量定制。相比直接复制 OmniProxy，可以保留已验证的 Wails 工具链与 Taskfile 模式，不引入网关、存储和发布逻辑。不启用实验性的 Wake 构建。

## 实施计划

1. 用 Wails v3 React + TypeScript 模板初始化 `desktop/`，对齐 Wails 工具链并使用 pnpm 锁定前端依赖。
2. 验证最小的 Go 与 React 绑定，提供依赖安装、启动、开发构建和质量检查命令。
3. 建立产品、架构、开发、任务和决策文档，并让 CI 使用同一套验证入口。

## 实际结果

- 初始化 Wails v3.1.0、Go 1.26 和 React + TypeScript + Vite；提供可调用 Go 服务的「检查连接」页面。
- 从根目录提供 `task setup`、`task dev`、`task build` 和 `task verify`；Windows CI 复用 `task verify`。
- 建立[文档索引](../../../README.md)和[桌面架构决策](../../../decisions/ADR-001-desktop-scaffold.md)。

## 验证与限制

- Windows 本机 `wails3 doctor`、`task verify`、`actionlint` 均通过。Go 测试覆盖后端连通返回值与内嵌首页；已生成 `desktop/bin/omnimail.exe`。
- 开发流程冒烟以 HTTP 探针替代原生窗口，验证 Wails 在 Vite 就绪后启动主进程、Vite 首页包含 OmniMail 标题和热更新入口。
- 未启动原生窗口，未验证 WebView 内实际点击，也未运行远端 CI 或生成发布包。
- Git：本记录与实现纳入同一个初始提交。可用 `git log --diff-filter=A --format=%h -- docs/tasks/completed/2026-11/TASK-20261120-001-bootstrap-desktop.md` 查询实现提交号。

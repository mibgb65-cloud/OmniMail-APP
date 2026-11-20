# 构建与启动

## 准备工具

本项目优先验证 Windows。安装 Go 1.26 和 `.nvmrc` 中的 Node.js 版本后，在 PowerShell 中安装工具：

```powershell
npm install -g pnpm@12.6.0
go install github.com/go-task/task/v3/cmd/task@v3.53.1
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.1.0
wails3 doctor
```

确保 Go 工具安装目录（`GOBIN` 或 `GOPATH\bin`）在 `PATH` 中，Windows 已安装 WebView2。无需启用实验构建或安装发布打包工具。

## 首次初始化与日常命令

从仓库根目录执行：

```powershell
task setup       # 首次检出或更新依赖后执行
task dev         # 启动原生窗口和 Vite 热更新，Ctrl+C 停止
task build       # 单独构建开发 EXE，不启动窗口
task run         # 运行已构建的 EXE，不启动 Vite
task verify      # 从干净检出也可直接运行
```

`task dev` 会先执行开发构建，然后启动 Vite 并等待它监听，最后运行原生窗口。Vite 只监听本机，默认端口为 `9245`；占用时可在 PowerShell 中执行 `$env:WAILS_VITE_PORT = "9250"` 后重试。Go 源码变化触发重新构建，React 源码变化由 Vite 热更新。

`task build` 顺序执行绑定生成、TypeScript 检查与 Vite 开发构建、Go 编译。Windows 产物为 `desktop/bin/omnimail.exe`；不含安装、签名或发布步骤。

## 常见问题

- 只想预览 React：先运行 `task setup` 和 `task bindings`，再运行 `pnpm --dir desktop/frontend dev`。普通浏览器没有桌面桥接，连通检查需要在原生窗口完成。
- Go 提示 `frontend/dist` 不存在：先用 `task build` 或 `task test`；不要在干净检出时直接运行普通的 `go build` / `go test`。
- 前端找不到绑定：运行 `task bindings`。`frontend/bindings/` 由 Wails 生成，不手改、不提交。

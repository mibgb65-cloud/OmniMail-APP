# 架构概览

仓库根目录管理开发命令、CI 和文档。`desktop/` 是独立 Go 模块，`desktop/frontend/` 是独立前端包；当前优先验证 Windows。

```text
React 界面
  → Wails 生成的 TypeScript 绑定
  → desktop/main.go 注册的 Go 服务
  → DesktopService.CheckConnection
```

- 界面负责交互和状态展示；Go 服务是本地能力的可信边界。未来接入账号或邮件数据时，Go 仍需校验绑定输入，不能依赖前端校验。
- 构建先生成绑定，再编译前端，最后由 Go 嵌入 `frontend/dist`。`bindings` 构建标签仅供生成器使用，可在没有 `dist` 时加载 Go 代码；普通构建必须嵌入真实产物。
- `task dev` 使用本地 Vite 热更新；直接运行已构建的 EXE 读取内嵌资源。当前没有额外的业务 HTTP 服务、数据库或远端同步。

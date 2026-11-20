# 测试与质量门

| 命令 | 用途 |
| --- | --- |
| `task test` | 生成绑定和真实前端产物，运行 Go 测试 |
| `task verify` | 安装锁定依赖、检查 Go 和前端格式、运行 ESLint/TypeScript、Go vet、Go 测试和开发构建 |

Go 测试覆盖连通服务返回值和内嵌首页。Windows CI 使用同一个 `task verify`。它不会启动桌面窗口，也不替代 WebView 实测。

涉及原生窗口或桥接时，再做一轮手工冒烟：运行 `task dev`，确认窗口标题为 OmniMail，点击「检查连接」，看到「已成功连接 OmniMail 桌面后端。」。验证内嵌模式时用 `task build` 和 `task run` 重复检查，不依赖 Vite。

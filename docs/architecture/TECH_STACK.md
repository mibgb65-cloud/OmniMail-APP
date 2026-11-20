# 技术栈

| 层 | 当前选型 |
| --- | --- |
| 桌面 | Go 1.26，Wails v3.1.0，Windows WebView2 |
| 前端 | React 19、TypeScript 5.9、Vite 8，普通 CSS |
| 工具 | Node.js 22.19.0、pnpm 12.6.0、Task 3.53.1 |
| 验证 | gofmt、go vet、Go testing、Prettier、ESLint、TypeScript |

精确依赖以 `desktop/go.mod`、`desktop/frontend/package.json` 及锁文件为准。升级 Wails 时同步检查 Go 模块、CLI 和 `@wailsio/runtime`，从干净状态重新生成绑定并跑 `task verify`。在有实际业务需求前，不引入路由、全局状态库或数据库。

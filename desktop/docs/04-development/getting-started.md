# 快速开始

> 状态：已生效 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[工程结构](project-structure.md) · [环境要求](environment.md) · [故障排查](troubleshooting/README.md)

---

## 1. 五分钟跑起来

### 1.1 前置检查

```bash
go version        # 需要 >= 1.22
node -v           # 需要 >= 20
wails version     # 需要 v2.8+
```

任一项缺失，先按 [环境要求](environment.md) 安装。

### 1.2 获取代码与依赖

```bash
git clone <REPO_URL> OmniMail-APP
cd OmniMail-APP/desktop

# Go 依赖
go mod download

# 前端依赖
cd frontend && npm ci && cd ..

# 安装 Wails CLI（如尚未安装）
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails doctor          # 检查平台依赖是否齐全
```

### 1.3 开发模式

```bash
cd desktop
wails dev
```

- 前端热更新（Vite），Go 改动自动重编译。
- 首次启动会在数据目录创建 `omnimail.db` 与 `logs/`。

### 1.4 构建

```bash
cd desktop
wails build -platform windows/amd64     # 或 darwin/universal
# 产物：desktop/build/bin/OmniMail.exe
```

## 2. 第一次运行会看到什么

1. 空账号引导页（还没有任何账号时）。
2. 添加账号后自动开始首次同步，列表逐步填充。
3. 数据目录（默认）：

| 平台 | 路径 |
| --- | --- |
| Windows | `%APPDATA%\OmniMail\` |
| macOS | `~/Library/Application Support/OmniMail/` |

```
OmniMail/
├── omnimail.db          # 主库
├── omnimail.db-wal
├── attachments/         # 附件（sha256 分桶）
├── bodies/              # 超大小正文
├── backups/             # 自动备份
├── logs/                # 按天轮转
├── secrets/             # 仅钥匙串不可用时的降级存储
└── window_state.json
```

## 3. 常用命令

| 目的 | 命令 |
| --- | --- |
| 全量测试 | `go test ./... ` |
| 单个包测试 | `go test ./internal/service/... -run TestSync -v` |
| race 检测 | `go test -race ./internal/...` |
| 前端类型检查 | `cd frontend && npm run typecheck` |
| 前端单测 | `cd frontend && npm run test` |
| 前端构建 | `cd frontend && npm run build` |
| 生成绑定 | `wails generate module` |
| 查看日志 | `tail -f "$APPDATA/OmniMail/logs/app.log"`（Windows 用 `Get-Content -Wait`） |
| 重置本地数据 | 退出应用后删除数据目录（**会丢失本地邮件**） |

## 4. 分支与提交

见 [Git 提交规范](../00-guidelines/git-conventions.md)。开工前：

```bash
git switch -c feat/mail-list-pagination
```

## 5. 提交前自检

```bash
gofmt -l ./internal          # 必须无输出
go vet ./...                 # 必须无告警
go test ./...                # 必须全绿
cd frontend && npm run lint && npm run typecheck && npm run test
```

## 6. 需要帮助

- 构建/依赖问题 → [故障排查](troubleshooting/README.md)
- 接口不清楚 → [API 契约](api/README.md)
- 设计疑问 → [设计系统](../03-design/design-system.md)
- 任务分配 → [任务看板](../07-tasks/README.md)

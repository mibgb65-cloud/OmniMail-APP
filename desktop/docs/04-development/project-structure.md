# 工程结构

> 状态：已生效 | 负责人：@arch-lead | 最后更新：2026-10-24
> 相关：[后端架构](../02-architecture/backend/README.md) · [前端架构](../02-architecture/frontend/README.md) · [快速开始](getting-started.md)

---

## 0. 当前已实现结构

以下为实际工程骨架。后文的业务分层与文件树描述后续目标，不代表对应模块已经实现。

```text
OmniMail-APP/
├── README.md
├── desktop/
│   ├── main.go                 # 入口
│   ├── assets_dev.go           # 开发模式嵌入入口，运行时代理 Vite
│   ├── assets_production.go    # production 标签下嵌入 frontend/dist
│   ├── go.mod / go.sum         # Go 依赖与固定版本 Wails CLI
│   ├── Taskfile.yml            # setup / dev / check / build / run / bindings
│   ├── build/config.yml        # Wails v3 开发进程编排与应用元数据
│   ├── internal/
│   │   ├── app/app.go          # 窗口、生命周期、单实例与绑定装配
│   │   ├── bridge/             # AppBridge.Version 与测试
│   │   ├── config/             # 环境配置、输入校验与测试
│   │   └── logger/             # 结构化日志、按天轮转、脱敏与测试
│   ├── frontend/
│   │   ├── bindings/           # Wails 自动生成的 TypeScript 绑定
│   │   ├── public/mail.svg
│   │   └── src/{app,lib,styles,test}
│   └── docs/
└── android/、ios/、docs/        # 预留目录
```

`desktop/bin/`、`desktop/.devdata/`、`frontend/node_modules/` 与 `frontend/dist/` 为本地产物，由 Git 忽略。当前没有数据库、邮件业务服务、安装包资源或 CI 配置；工程根配置为 `Taskfile.yml` 和 `build/config.yml`，不使用 Wails v2 的 `wails.json`。

## 1. 顶层结构

```
OmniMail-APP/
├── .git/
├── android/                    # 独立端（不共享代码）
├── ios/                        # 独立端
├── docs/                       # 仓库级跨端文档
└── desktop/                    # ★ 桌面端主工程
    ├── docs/                   # 本文档所在位置
    ├── build/                  # 构建资源与产物配置
    │   ├── appicon.png         # 应用图标源（1024×1024）
    │   ├── tray*.png           # 托盘图标
    │   ├── windows/            # info.json（版本信息、签名配置）
    │   ├── darwin/             # Info.plist 与权限声明
    │   └── bin/                # 构建产物（git 忽略）
    ├── frontend/               # React 前端
    ├── internal/               # Go 业务代码（外部不可 import）
    ├── go.mod
    ├── go.sum
    ├── wails.json              # Wails 工程配置
    └── main.go                 # 入口：调用 app.Run()
```

## 2. Go 侧结构

```
desktop/
├── main.go
└── internal/
    ├── app/
    │   ├── app.go              # App 结构、startup/shutdown
    │   ├── window.go           # 窗口尺寸/位置/状态持久化
    │   ├── menu.go             # 应用菜单
    │   └── single_instance.go
    ├── bridge/
    │   ├── set.go              # 绑定集合装配
    │   ├── account.go
    │   ├── mail.go
    │   ├── compose.go
    │   ├── sync.go
    │   ├── search.go
    │   ├── settings.go
    │   ├── appinfo.go
    │   ├── dto.go              # DTO 与 domain 的转换
    │   └── errors.go           # APIError 映射
    ├── config/
    │   ├── config.go           # 结构体、默认值、校验
    │   ├── load.go             # 加载顺序（默认→文件→env→flag）
    │   └── providers.go        # 服务商预设表
    ├── domain/
    │   ├── account.go
    │   ├── mail.go
    │   ├── mailbox.go
    │   ├── draft.go
    │   ├── sync.go
    │   ├── search.go
    │   ├── errors.go
    │   └── interfaces.go       # 仓储/服务接口
    ├── logger/
    │   ├── logger.go           # 结构化日志、脱敏
    │   └── rotate.go
    ├── platform/
    │   ├── platform.go         # 接口定义
    │   ├── notify_windows.go
    │   ├── notify_darwin.go
    │   ├── tray_windows.go
    │   ├── tray_darwin.go
    │   ├── hotkey_windows.go
    │   ├── hotkey_darwin.go
    │   ├── keychain_windows.go
    │   ├── keychain_darwin.go
    │   ├── shell_*.go
    │   └── fake/fake.go        # 测试替身
    ├── repository/
    │   ├── sqlite/
    │   │   ├── db.go           # 打开、PRAGMA、事务封装
    │   │   ├── account_repo.go
    │   │   ├── mail_repo.go
    │   │   ├── mailbox_repo.go
    │   │   ├── draft_repo.go
    │   │   ├── pending_repo.go
    │   │   ├── sync_state_repo.go
    │   │   ├── fts_repo.go
    │   │   └── migrations/
    │   │       ├── 0001_init.sql
    │   │       └── ...
    │   ├── fsstore/
    │   │   └── attachment_store.go
    │   └── keychain/
    │       └── credential_store.go
    └── service/
        ├── set.go              # 服务集合与依赖注入
        ├── account_service.go
        ├── mail_service.go
        ├── compose_service.go
        ├── sync_service.go
        ├── sync_worker.go
        ├── scheduler.go
        ├── search_service.go
        ├── indexer.go
        ├── imap/               # IMAP 协议适配
        │   ├── client.go
        │   ├── idle.go
        │   └── parser.go
        └── smtp/
            └── sender.go
```

## 3. 前端结构

见 [前端文件组织](../02-architecture/frontend/file-organization.md)。

## 4. 当前生成代码（勿手改）

| 路径 | 生成方式 | 说明 |
| --- | --- | --- |
| `frontend/bindings/**` | 在 `desktop/` 执行 `go tool wails3 task bindings` | 当前版本绑定、模型与运行时类型 |
| `frontend/src/lib/bridge/app.ts` | 手写封装 | 校验不可信返回值，统一超时、取消与错误处理 |

> `bindings/` 目录不手改；需要的封装写进 `src/lib/bridge/`。

## 5. 新增一个功能的改动路径（模板）

以"邮件批量归档"为例：

```
1. domain/mail.go           新增 FlagPatch 或方法签名（如需）
2. domain/interfaces.go     仓储接口新增方法（如需）
3. repository/sqlite/...    实现 SQL + 测试
4. service/mail_service.go  用例编排 + 事件 + 队列
5. bridge/mail.go           绑定方法 + DTO
6. bridge/dto.go            转换函数
7. frontend/src/lib/bridge  前端封装与类型
8. frontend/src/features/mail/{api,hooks,components}
9. 测试：service_test.go / MailList.test.tsx
10. 文档：01-product/features 与 04-development/api 同步
```

## 6. 不该出现在仓库里的东西

- 二进制产物、日志、数据库文件、`node_modules`、`dist`。
- 任何凭据、密钥、证书私钥。
- IDE 配置（`.vscode` 只允许 `settings.json` + `extensions.json`，且不含本机路径）。

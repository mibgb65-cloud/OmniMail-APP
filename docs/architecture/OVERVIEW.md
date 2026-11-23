# 架构概览

仓库根目录管理开发/打包命令、CI 和文档。`desktop/` 是纯 Go 零 CGO 桌面后端模块，`desktop/frontend/` 是 React 19 + TypeScript 5.9 前端模块，优先支持 Windows 10/11 (x64)。

```text
React 19 工作台 (src/services/backendClient.ts)
  → Wails v3 TypeScript 强类型绑定 & 11 类异步事件总线 (omnimail:*)
  → desktop/main.go 注册的 9 个 Go Services + 受控本地媒体流 (/omnimail-cid/, /omnimail-attachment/)
  → internal/{profilemgr, accounts, oauth, mailproto, syncer, search, outbox, contacts, rules, ai, security, diagnostics, storage}
  → %APPDATA%\OmniMail\bootstrap.json → getDataDir()\profiles\<profileId>\{mail.db, secrets.vault, settings.json, blobs/}
```

- **9 个可信边界 Wails v3 Service**：`DesktopService`、`ProfileService`、`AccountService`、`MailService`、`ComposeService`、`ContactService`、`RuleService`、`AiService`、`DiagnosticService`；所有外部输入、网络协议交互、文件读写与凭据加解密均收敛在 Go 侧完成。
- **无云登录本地多空间与存储隔离**：每个本地空间拥有独立 `mail.db`（`modernc.org/sqlite` WAL + 外键 + FTS5 `trigram`）、独立 DPAPI 加密 `secrets.vault` 与独立 CAS 目录（`blobs/raw/*.eml.zst`、`blobs/attachments/`）；目录迁移或 ZIP 备份前自动暂停后台 `SyncWorker` 并执行 `PRAGMA wal_checkpoint(TRUNCATE)`。
- **双连接同步管线与安全闭环**：`SyncWorker` 入库管线通过 `MailPipelineCoordinator` 串联黑名单前置拦截、本地 SPF/DKIM/DMARC 启发式钓鱼检测、`.ics` 日程冲突计算、自动化规则引擎、联系人自动沉淀与 RFC3834 防循环休假回复；AI 网关强制经 5 步 `PrivacyGuard` 校验与正则脱敏后才发起 SSE 请求。

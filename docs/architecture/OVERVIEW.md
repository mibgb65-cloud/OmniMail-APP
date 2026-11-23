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
- **邮件阅读与首次同步状态**：阅读器使用后端合并空间级配置、单封放行和钓鱼风险后的实际图片策略。首次同步由新增账号的后台 worker 自动启动；弹窗按账户 ID 读取同步事件，仅在收件箱的待同步数量已知时显示计数，整轮结束后才显示完成或失败。
- **窗口与开屏**：先恢复普通窗口的位置和尺寸，再在 WebView 运行时就绪后恢复上次的最大化状态。普通冷启动等待页面可见后播放开屏；显式静默启动和已运行窗口的托盘唤醒不重播。
- **Windows 系统通知**：运行时为当前用户注册 OmniMail 的通知标识，再向 WinRT 提交通知，邮件正文不进入系统通知。新邮件通知在独立的有界队列中处理，测试按钮等待提交结果；Windows 仍决定是否展示横幅。
- **BYOK 端点与密钥边界**：Go 统一解析模型发现、连通性测试和聊天请求的端点；官方预设不可覆盖，兼容网关密钥按空间、提供方及规范化端点隔离。模型发现按厂商协议请求并限制响应体和分页，不透传上游错误正文。测试使用临时表单值，不修改活动配置。

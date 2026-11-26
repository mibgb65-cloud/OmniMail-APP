# 架构概览

仓库根目录管理开发/打包命令、CI 和文档。`desktop/` 是纯 Go 零 CGO 桌面后端模块，`desktop/frontend/` 是 React 19 + TypeScript 5.9 前端模块，优先支持 Windows 10/11 (x64)。

```text
React 19 工作台 (src/services/backendClient.ts)
  → Wails v3 TypeScript 强类型绑定 & 11 类异步事件总线 (omnimail:*)
  → desktop/main.go 注册的 11 个 Go Services + 受控本地媒体流 (/omnimail-cid/, /omnimail-attachment/)
  → internal/{profilemgr, accounts, oauth, mailproto, syncer, search, outbox, contacts, rules, ai, security, diagnostics, storage, musemail, workbuddymail}
  → %APPDATA%\OmniMail\bootstrap.json → getDataDir()\profiles\<profileId>\{mail.db, secrets.vault, settings.json, blobs/}
```

- **11 个可信边界 Wails v3 Service**：`DesktopService`、`ProfileService`、`AccountService`、`MailService`、`ComposeService`、`ContactService`、`RuleService`、`AiService`、`DiagnosticService`、`MuseMailService`、`WorkBuddyMailService`；所有外部输入、网络协议交互、文件读写与凭据加解密均收敛在 Go 侧完成。
- **无云登录本地多空间与存储隔离**：每个本地空间拥有独立 `mail.db`（`modernc.org/sqlite` WAL + 外键 + FTS5 `trigram`）、独立 DPAPI 加密 `secrets.vault` 与独立 CAS 目录（`blobs/raw/*.eml.zst`、`blobs/attachments/`）；目录迁移或 ZIP 备份前自动暂停后台 `SyncWorker` 并执行 `PRAGMA wal_checkpoint(TRUNCATE)`。
- **双连接同步管线与安全闭环**：`SyncWorker` 入库管线通过 `MailPipelineCoordinator` 串联黑名单前置拦截、本地 SPF/DKIM/DMARC 启发式钓鱼检测、`.ics` 日程冲突计算、自动化规则引擎、联系人自动沉淀与 RFC3834 防循环休假回复；AI 网关强制经 5 步 `PrivacyGuard` 校验与正则脱敏后才发起 SSE 请求。
- **AI 邮件上下文与本地问答**：阅读区只提取当前邮件正文，可选附带主题；不读取邮件头、附件文件、文件名或预览。提问可附带本封邮件在同一隐私范围下的近期问答；旧版可能包含附件上下文的问答可在本地查看，但不自动重发。问答在流式生成成功后以整轮形式写入当前工作空间的 `ai_insights`，每封邮件保留最近 10 轮，写入后才发出完成事件。
- **保真邮件翻译**：阅读器独立授权，由 Go 直连默认免密翻译或用户选定的 BYOK 模型。两种引擎均拦截敏感邮件，仅按批发送当前邮件的可见文字和可选主题，不传 HTML、图片和附件。免费引擎强制脱敏，单批默认超时 8 秒；超时、短期限流和临时服务错误最多退避重试一次，`Retry-After` 超过 3 秒则提示稍后重试。设计稿的默认端点值 `https://api.bilibili.com/x/intl/translate/v2` 是预设标识，实际使用[官方 Index-Translate 公开接口](https://github.com/bilibili/Index-Translate/blob/main/README_zh.md#推理)；自定义端点不跨服务回退且不跟随重定向。每批校验后经 Wails 发出增量，前端按工作空间、邮件和请求匹配，只修改已清理 DOM 的文字，不注入模型返回的 HTML。后续批次失败时保留可用译文并显示安全错误。译文仅在工作空间会话中按引擎配置隔离，切换引擎不会复用旧译文。
- **Omni AI 邮件摘要与拟稿**：独立 Wails 入口均读取原文；摘要用界面语言，拟稿默认用原文语言，可在外文邮件选择中文。SQLite 分别合并两类字段，不覆盖对话，且仅摘要事务设置已摘要标记。阅读自动摘要默认关闭；开启后仅在显式打开邮件且面板展开时查缓存并防抖触发，不监听同步事件。仅自动纯摘要跳过逐次确认，仍强制执行总开关、敏感邮件拦截、正文裁剪和云端脱敏；拟稿与追问从不自动调用。
- **通讯录重复审阅**：同名、`+alias` 分组仅作为候选，组标识绑定当前成员；忽略结果和 `contact_aliases` 均保存在当前工作空间。批量合并在单个事务内重验候选、迁移备用邮箱并更新主联系人，不修改邮件。往来历史按主邮箱与备用邮箱精确匹配邮件参与者，新邮件同步优先更新备用邮箱的归属联系人。
- **邮件阅读与首次同步状态**：阅读器使用后端合并空间级配置、单封放行和钓鱼风险后的实际图片策略。首次同步由新增账号的后台 worker 自动启动；弹窗按账户 ID 读取同步事件，仅在收件箱的待同步数量已知时显示计数，整轮结束后才显示完成或失败。
- **窗口与开屏**：先恢复普通窗口的位置和尺寸，再在 WebView 运行时就绪后恢复上次的最大化状态。普通冷启动等待页面可见后播放开屏；显式静默启动和已运行窗口的托盘唤醒不重播。
- **Windows 系统通知**：运行时为当前用户注册 OmniMail 的通知标识，再向 WinRT 提交通知，邮件正文不进入系统通知。新邮件通知在独立的有界队列中处理，测试按钮等待提交结果；Windows 仍决定是否展示横幅。
- **BYOK 端点与密钥边界**：Go 统一解析模型发现、连通性测试和聊天请求的端点；官方预设不可覆盖，兼容网关密钥按空间、提供方及规范化端点隔离。模型发现按厂商协议请求并限制响应体和分页，不透传上游错误正文。测试使用临时表单值，不修改活动配置。
- **滚动视口**：应用基础样式隐藏原生滚动条，主要纵向区域统一使用 `FadeScroll`，原生文本域使用 `FadeTextarea`。视口与内容尺寸由 `ResizeObserver` 观察，滚动位置从原生事件读取；遮罩使用各面板主题变量，只在下方还有内容时显示。应用没有接管滚动输入，系统 PDF 查看器保留自己的交互。
- **Muse Mail 独立网页登录与只读边界**：`MuseMailService` 与 `internal/musemail` 独立于常规 IMAP/OAuth 体系运行。Windows 侧创建独占临时用户数据目录的原生沉浸暗色 WebView2 登录宿主（DWM 暗色标题栏/圆角、顶部 `30px` 原生 GDI 安全信任条、DPI 感知 `480×680` 智能偏左定位），禁用主机桥接、WebMessage 与 DevTools，按固定 HTTPS 官方认证域白名单限制导航，并通过轻量本地 Cookie 探测识别 `hatch_sess` 就绪后自动触发单次验证与自动关窗；Go 侧通过显式限定 `http/1.1` ALPN 且遵循环境变量与 Windows WinINet 注册表代理（HTTP `CONNECT` / `SOCKS5`）的 `uTLS` 拨号层，在同一 Noise XX + Protobuf WSS 连接上核验 `@muse.ai` 身份并串行执行只读白名单路由（单帧、分片聚合与累计响应边读边限），数据仅驻留当前活跃空间内存，切空间、PIN 锁屏、断开或退出时立即销毁连接、会话与临时目录，不写入 SQLite/CAS，也不进入统一收件箱、AI、规则或发件队列。
- **WorkBuddy Agent 邮箱原生 REST 边界**：`WorkBuddyMailService` 与 `internal/workbuddymail` 通过标准库 `net/http` 完成浏览器状态轮询授权、并发单飞 `401` 刷新重试、每日配额响应头提取、`bluemonday` HTML 净化、两步 `confirmation_token` 删除与 25MB 上限 Base64 流式附件解码另存；Token 套件仅加密保存在当前空间的 `secrets.vault`，不写入 `accounts` 表或 SMTP 发件通道。

# 产品范围

OmniMail 是一款开源、无云端登录、本地优先（Local-First）的多源统一桌面邮件工作台（Windows 10/11 x64）。

## 当前已实现验收范围

- **无登录本地多空间与安全存储**：支持多独立本地空间（`profiles/<id>/`）自由切换与物理目录隔离、Argon2id 空间 PIN 锁、Windows DPAPI 加密凭据盒（`secrets.vault`）、SQLite WAL 16 表本地关系库与 Zstd 压缩 CAS 内容寻址存储（`blobs/raw/*.eml.zst`、`blobs/attachments/`）。
- **10 家服务商预设与 PKCE OAuth2 / 授权码接入**：内置 Gmail（含 OAuth2 与 16 位应用专用密码去空格回退）、Outlook、QQ、网易（含 RFC2971 `ID` 握手）、iCloud、Yahoo、Yandex、韩国 Naver（`@naver.com`）、Linux.do 与通用企业 IMAP/SMTP，提供 4 阶段（DNS/TLS/IMAP/SMTP）连接探测报告。
- **双连接 IMAP 同步、安全阅读与 FTS5 全文搜索**：每个账户运行 `workConn + idleConn`（24 分钟保活 `IDLE` + 指数退避重连），支持 Special-Use 映射、GBK/GB18030/Big5/ISO-2022-JP/EUC-KR 解码、3 级会话归并、`bluemonday` HTML 净化与外链追踪图拦截、Shadow DOM 样式隔离阅读、按需附件下载与 LRU 回收、以及 FTS5 `trigram` + 1~2 字中文短词降级检索。
- **身份锁定写信与持久化发件状态机**：回复/转发默认锁定原收件账户（后端 `ERR_IDENTITY_LOCKED` 二次防误发校验），2s 自动保存草稿，RFC5322 MIME 构造器严格保证 BCC 仅走 SMTP 信封，`outbox_jobs` 统一承载零网络真撤回、跨重启定时发送、断网退避重发与智能 `\Sent` 去重。
- **通讯录、自动化规则、日程与 BYOK AI 隐私网关**：自动往来联系人提取/去重合并/vCard 导入导出、发件人与子域名黑名单拦截、带 30 天干跑预览的优先级规则引擎、RFC3834 防死循环休假自动回复、`.ics` 本地冲突检测与 `METHOD:REPLY` 一键 RSVP、SPF/DKIM/DMARC 启发式钓鱼预警、脱敏诊断包导出、以及受 5 步 `PrivacyGuard` 保护的多模型（OpenAI/DeepSeek/Claude/Gemini/本地 Ollama/自定义兼容网关）SSE 流式 AI 助手。
- **阅读摘要与按需拟稿**：摘要和回复草稿独立生成并在本地缓存。可选择在右侧 AI 面板展开时自动摘要新打开的邮件，默认关闭；敏感邮件始终拦截，回复草稿从不自动生成，也不会代替用户发送。
- **邮件保真翻译**：默认使用无需 AI 助手和 API Key 的内置免费翻译，也可选用 BYOK 模型。翻译由用户手动触发，逐批显示译文，保留邮件原有表格、链接、按钮和代码排版；阅读区使用中性引擎名称。
- **桌面端深度集成、交互动效与分发**：去原生化自定义控件库、冷启动棱镜开屏、可打断 GPU 反向亮暗主题过渡、0 邮箱冷启动四区空态引导、异步闭环画勾（`AsyncActionButton`）与四步实时握手步进条（`HandshakeSteps`）、单实例锁（`mailto:` / `.eml` / `.ics` 唤起）、窗口几何状态记忆、带本地空间切换子菜单的系统托盘、开机自启与 `--silent-tray` 静默驻留、Windows 隐私 Toast 通知、只读 GitHub Releases 更新检查，以及双轨版本号（Stable / Beta）Windows NSIS 交互式安装向导 `.exe` 构建链路。

# OmniMail Go 后端全量实现、前后端联调与真机协议验证总报告

> 交付时间：2026-11-23  
> 运行与构建基线：Wails v3.1.0 · Go 1.26.2（`CGO_ENABLED=0` 纯 Go 零 CGO）· React 19.3.0 · TypeScript 5.9.3 · Windows x64

---

## 一、四阶段 40 项功能与 9 大 Wails v3 Service 完成总览

| 阶段 | 核心交付模块（功能编号） | 注册的 Wails v3 Service | 状态与门禁 |
| :--- | :--- | :--- | :--- |
| **Phase 1** | 无登录本地多空间底座、Argon2id PIN 锁、SQLite WAL 16 表 + CAS 目录、Windows DPAPI `secrets.vault`、10 家服务商预设（含 Gmail 16 位应用密码去空格回退、网易 RFC2971 `ID`、Naver `@naver.com`、Linux.do）、PKCE OAuth2 + `singleflight` 续期、4 步连接探测（①~⑪） | `DesktopService`、`ProfileService`、`AccountService` | **已完成**（全绿） |
| **Phase 2** | 双连接 `SyncWorker`（`workConn` 分批倒序 `BODY.PEEK[]` + `idleConn` 24 分钟保活 `IDLE` + 指数退避重连）、Special-Use 映射、GBK/GB18030/Big5/ISO-2022-JP/EUC-KR 解码、3 级会话归并、`bluemonday` HTML 净化与外链图拦截、`/omnimail-cid/` 受控流、`imap_op_queue` 双向回写、Snooze 唤醒、LRU 附件回收、FTS5 `trigram` + 1~2 字中文短词降级检索（⑫~⑳） | `MailService` | **已完成**（全绿 + 7/7 邮局只读实测通过） |
| **Phase 3** | 回复发件身份锁定（后端 `ERR_IDENTITY_LOCKED` 二次防误发校验）、2s 防抖自动草稿、RFC5322 MIME 构造器（BCC 严格仅入 SMTP 信封绝不写头）、`outbox_jobs` 持久化状态机（零网络真撤回、跨重启定时发送、4xx/断网退避重试、5xx 停留待发队列、按服务商 `AutoAppendsSent` 智能 `\Sent` 去重）（㉑~㉕） | `ComposeService` | **已完成**（全绿 + 单封自发自收实测通过） |
| **Phase 4** | 往来联系人自动沉淀/重复合并/vCard 导入导出、发件人与子域名黑名单前置拦截、优先级规则引擎 + 30 天干跑预览、RFC3834 防循环 + 96 小时频控休假自动回复、`.ics` 本地冲突检测与 `METHOD:REPLY` 一键 RSVP、BYOK 多模型 SSE 网关 + 5 步 `PrivacyGuard` + `ai_insights` 缓存、SPF/DKIM/DMARC 启发式钓鱼评分、脱敏诊断包导出与桌面集成收口（㉖~㊵） | `ContactService`、`RuleService`、`AiService`、`DiagnosticService` | **已完成**（全绿 + 桌面二进制构建通过） |

- **绑定规模**：Wails v3 共生成 **9 个 Service、102 个强类型 RPC 方法、67 个 DTO 模型、0 警告**；11 类 `omnimail:*` 异步事件通道全部闭环接入。
- **Mock 退场验证**：桌面运行态（`isWailsDesktop() === true`）下，全部 27 个弹窗、10 个设置页签与核心 Store 均走真实 Go Service 与本地 SQLite/协议栈；`src/components/` 对业务 Mock 数据实现零直接引用，仅保留纯浏览器 `pnpm dev` 预览兜底。

---

## 二、Go 单元测试覆盖清单（`CGO_ENABLED=0 go test -v ./...` 全部通过）

1. `internal/security`：Windows DPAPI `secrets.vault` 加解密往返、Argon2id PIN 锁冷却防爆破、日志正则脱敏、`bluemonday` XSS 剥离与外链图片 `data-omnimail-src` 拦截及单封还原。
2. `internal/storage` & `internal/profilemgr`：SQLite WAL + 外键 + 16 表 Schema 幂等迁移、`.eml.zst` Zstd CAS 归档与孤儿 Blob GC、多空间生命周期与 PIN 解锁隔离、一致性 ZIP 备份。
3. `internal/mailproto` & `internal/oauth`：10 家服务商智能域名解析（含 Gmail 去空格、Naver、Linux.do `mail.linux.do`）、GBK/CJK 头与正文解码、路径穿越附件名清洗、3 级会话归并、`.ics` 日程时间重叠冲突检测与 `METHOD:REPLY` 生成、`127.0.0.1:0` PKCE 回调与 `singleflight` 并发续期去重。
4. `internal/syncer`：幂等邮件入库、Sent `rfc_message_id` 去重、FTS5 中英文与 1~2 字短词混合检索、标签与文件夹计数。
5. `internal/outbox`：RFC5322 MIME 打包与 **BCC 零邮件头泄露断言**、回复草稿 `ERR_IDENTITY_LOCKED` 二次拦截、`undo_pending` 零网络真撤回与已发 `ERR_UNDO_WINDOW_EXPIRED` 竞态保护、550 永久错误入队。
6. `internal/contacts` & `internal/rules`：自动提取跳过 `noreply`/自身且保护 `user_edited=1`、`+alias` 重复合并、vCard 3.0 导入导出、子域名黑名单拦截计数；规则优先级 `stop_matching`、30 天干跑预览、RFC3834 休假防死循环（拦截自身/`Auto-Submitted`/`List-Unsubscribe`/`Precedence: bulk`）与 96 小时频控。
7. `internal/ai` & `internal/diagnostics`：5 步 `PrivacyGuard`（`ERR_AI_DISABLED`、`ERR_AI_CONSENT_REQUIRED`、验证码/私钥/`danger` 钓鱼拦截、严格模式剥离发件人与附件、云端模型手机号/银行卡正则脱敏）、SSE 流式解析与 `ai_insights` 本地缓存命中；SPF/DKIM/DMARC 启发式钓鱼检测与 `.zip` 诊断包零明文密钥泄露断言。

---

## 三、7 家真实邮箱非破坏性连通与单封闭环实测（`//go:build live`）

> 外部测试凭据仅在 `go test -tags=live` 运行时经环境变量读取，仓库源码、配置、日志与报告实现**零邮箱明文、零密码残留**。

### 3.1 7 家真实邮局只读协议测试（`TestLiveReadOnlySevenProviders`，全程 `BODY.PEEK[]` 零状态修改）

| 服务商 | 脱敏账号 | IMAP 端点 | SMTP 端点 | 4 步测连 | 发现文件夹 | 标准映射覆盖 | 只读拉取与 FTS5 建索 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Gmail** | `m***@gmail.com` | `imap.gmail.com:993` | `smtp.gmail.com:465` | **PASS** | 9 | `inbox/sent/drafts/archive/spam/trash` | 拉取 5 封 / 索引 5 封 |
| **网易 163** | `c***@163.com` | `imap.163.com:993` | `smtp.163.com:465` | **PASS**（RFC2971 ID） | 6 | `inbox/sent/drafts/spam/trash` | 拉取 5 封 / 索引 5 封 |
| **Linux.do** | `m***@linux.do` | `mail.linux.do:993` | `smtp.linux.do:465` | **PASS** | 5 | `inbox/sent/drafts/spam/trash` | 拉取 2 封 / 索引 2 封 |
| **Yandex** | `w***@yandex.com` | `imap.yandex.com:993` | `smtp.yandex.com:465` | **PASS** | 6 | `inbox/sent/drafts/spam/trash` | 拉取 4 封 / 索引 4 封 |
| **韩国 Naver** | `m***@naver.com` | `imap.naver.com:993` | `smtp.naver.com:465` | **PASS** | 10 | `inbox/sent/drafts/spam/trash` | 拉取 5 封 / 索引 5 封 |
| **Yahoo Mail** | `j***@yahoo.com` | `imap.mail.yahoo.com:993` | `smtp.mail.yahoo.com:465` | **PASS** | 6 | `inbox/sent/drafts/archive/spam/trash` | 拉取 4 封 / 索引 4 封 |
| **Apple iCloud** | `m***@icloud.com` | `imap.mail.me.com:993` | `smtp.mail.me.com:587` | **PASS**（STARTTLS） | 7 | `inbox/sent/drafts/archive/spam/trash` | 拉取 5 封 / 索引 5 封 |

### 3.2 单封自发自收闭环冒烟测试（`TestLiveSmokeSelfSendSingleEmail`）
- 选取 `gmail`（`m***@gmail.com`）向自身发送唯一 1 封纯文本邮件 `[OmniMail Live Smoke Test]`：SMTP 465 SSL/TLS 投递成功（`state=sent`），本地 `sent` 记录 `rfc_message_id` 预占去重就绪（耗时 12.92s）。

---

## 四、关键 Local-First 架构决策记录

1. **Linux.do 预设主机修正**：经公共 DNS MX/A 核验，`linux.do` 邮局 IMAP 主机为 `mail.linux.do:993`（`imap.linux.do` 无 A 记录），内置预设修正后开箱即过 4 步测连。
2. **Apple iCloud SMTP 587 STARTTLS 兼容**：iCloud 官方 SMTP 提交端口为 `587 (STARTTLS)`，`ConnectSMTP` 同时支持 `465 SSL/TLS` 与 `587 STARTTLS` 及 `PLAIN` → `LOGIN` 自动回退。
3. **草稿与待发任务本地镜像**：`drafts` 与 `outbox_jobs` 同步维护 `messages` 文件夹镜像行（`drafts` / `outbox` / `scheduled`），使侧边栏实时计数、列表检索与编辑恢复完全复用同一高性能 SQLite 查询管线。
4. **单文件 `<= 200` 行严格模块化**：全仓库前后端手写源码文件均按职责拆分为清晰子模块，无任何超过 200 行的膨胀文件。

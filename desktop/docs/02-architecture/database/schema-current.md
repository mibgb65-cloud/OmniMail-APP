# 当前数据库结构：账号与邮件持久化 v3

> 状态：schema v3 已落地，正文自动补齐实现待评审 | 最后更新：2026-10-31
> 任务：[TASK-0030](../../07-tasks/archive/2026/10/TASK-0030-account-storage-foundation.md)

## 1. 权威来源

- 真实结构：[0001_accounts.sql](../../../internal/repository/migrations/0001_accounts.sql)。
- 追加邮件缓存：[0002_mail.sql](../../../internal/repository/migrations/0002_mail.sql)，不修改 0001。
- 富正文与内嵌图引用：[0003_rich_mail.sql](../../../internal/repository/migrations/0003_rich_mail.sql)；
  TASK-0058 复用现有列，不增加迁移或修改任何已应用脚本。
- 数据库打开、身份校验及连接设置：[sqlite.go](../../../internal/repository/sqlite.go)。
- 迁移执行：[migrations.go](../../../internal/repository/migrations.go)。
- 输入校验与领域接口：[account.go](../../../internal/domain/account.go)。
- 账号读写：[account.go](../../../internal/repository/account.go)、
  [account_read.go](../../../internal/repository/account_read.go)。

不复制另一份 DDL；本文用于说明语义，SQL 和测试为实际约束来源。
旧 [schema.md](schema.md) 中的邮件表和示例不代表当前版本；邮件缓存任务见
[TASK-0035](../../07-tasks/archive/2026/10/TASK-0035-mail-persistence.md)。

## 2. 基础设施

| 项 | 当前实现 |
| --- | --- |
| 引擎 | `modernc.org/sqlite v1.61.0`，纯 Go；无 ORM |
| 路径 | `config.DataDir/omnimail.db`；数据目录沿用现有配置及 `OMNIMAIL_DATA_DIR` |
| 数据库身份 | SQLite `application_id=0x4f4d4e49`；未知非空数据库拒绝初始化 |
| 并发 | 单连接池；短事务；事务中不执行网络或系统凭据操作 |
| 连接设置 | WAL、`foreign_keys=ON`、`busy_timeout=5000`、`synchronous=NORMAL` |
| ID | 标准库 `crypto/rand.Text()` 生成的不透明稳定文本 ID，不是邮箱地址、UID 或 ULID |
| 时间 | Unix 毫秒整数 |
| 关闭 | Wails 关闭回调与 `Run` 返回共用幂等资源收尾；关闭错误返回主入口 |
| FTS5 | 测试验证驱动能力可用，但未建立邮件全文索引或搜索 API |

仅接收普通本地绝对路径，不接受任意 SQLite URI、设备路径或 UNC 网络共享；
WAL 数据库不作为网络共享文件使用。目录创建权限不等同于 Windows ACL 或内容加密。
`synchronous=NORMAL` 保证事务一致性，但不承诺突然断电时最后提交的事务绝不丢失。

## 3. `account`

- 稳定 `id`；`provider_code` 不设置服务商枚举，可保存未来预设代码。
- `email` 是对外地址，`display_name`、`color_index`、`sort_order` 用于展示。
- `status` 为 `configured` / `reauth_required` / `disconnected`。
  `configured` 只表示配置已保存，不代表完成网络认证。
- `sync_enabled` 是用户偏好，不能用临时同步失败覆盖。
- `created_at` 创建后保持不变，`updated_at` 不早于创建或此前修改时间。
- 不以邮箱地址或 `(email, provider_code)` 自动合并账号；重复添加的用户交互仍待向导任务确定。
- 当前索引为 `(sort_order, created_at, id)`，账号列表按此顺序返回。

## 4. `account_endpoint`

- 每行具有稳定 `id`，外键 `account_id`，账号物理删除时级联删除连接。
- `UNIQUE(account_id, protocol)`，协议限 `imap` / `smtp`；完整账号校验要求两种连接各一条。
- 每条独立保存 `host`、`port`、`tls_mode`、`username`、`auth_kind`。
- 加密模式为 `implicit_tls` / `starttls`，认证为 `password` / `oauth2`。
  国际化主机使用 ASCII / Punycode；允许合法内网主机与 IP，不接受 URL。
- `credential_ref` 只接受应用命名空间 `omnimail/account/<opaque-id>[/imap|/smtp]`。
  断开时写 NULL；不保存密码、授权码、令牌或它们的密文。
- 索引 `credential_ref` 用于确认移除账号后是否还有其他引用。

账号与连接一起创建/更新；SQL 或约束失败时整笔回滚，不留下半个账号。
数据库本身不能表达“必须有两条连接”的跨行约束，调用仓储时由领域校验保证。

## 5. `schema_migration`

- 记录 `version`、`applied_at`、`checksum`；初始版本为 1，当前版本为 3。
- 初次空库初始化、迁移及历史记录在同一事务提交。
- 校验和使用完整 SQL 文件归一化 CRLF 为 LF 后的 SHA-256；包含 up/down，不能改写已应用迁移。
- 已知数据库丢失历史、历史缺号、未知更高版本、校验不符时拒绝继续迁移。
- 非空已知库存在待应用版本时，先用 `VACUUM INTO` 创建唯一命名的升级前快照；
  初次初始化与无升级的普通启动不创建备份。
- 不自动执行 down，不自动修复历史，不删除或覆盖用户数据库。

## 6. 账号移除与凭据边界

- `DisconnectAccount`：保留账号与连接，停用同步、置为 `disconnected`、清空凭据引用。
- `DeleteAccount`：仅删除该账号及其连接，不发送服务器删除命令。
- 仓储返回事务提交时已无其他引用的凭据引用；TASK-0036 服务层断开操作已编排系统条目删除，
  不向服务器发送删除。失败会明确报告，不把数据库与钥匙串当成同一个事务。
- 新增账号使用全新引用，两种 TLS 认证成功后才写凭据和 DB；失败逆向补偿，
  DB 提交结果不确定时先读回确认，不盲目删除已提交账号的凭据。
- 断开后的缓存可按该账号离线查看，不混入默认统一收件箱。尚未缓存的正文无法离线读取。

## 7. 服务商扩展

只在 [provider.go](../../../internal/domain/provider.go) 的 `ProviderPresets()` 增加定义并补测试，
不修改迁移、SQL 服务商约束或账号仓储。现有 Gmail、QQ、网易 163、网易 126、自定义预设
均返回独立配置；保存的是账号连接快照，后续修改预设不影响已保存账号。

预设已接入账号弹窗，但不是服务商兼容性认证：没有访问真实邮箱，不保证特定账号启用了
IMAP 或满足授权政策。当前使用密码/应用授权码；Gmail OAuth 需注册客户端，尚未实现，
界面明确提示只有允许应用密码的账号可走该入口。QQ、网易通常需要服务商授权码。
“新增预设无需迁移”适用于现有 IMAP/SMTP 和密码类/OAuth2 模型；新增协议或认证机制需另外评审。

## 8. 邮件正文与附件持久化 v3

- `mailbox`：账号内远端文件夹、角色、UIDVALIDITY、新增游标、历史核对游标。
- `mail_message`：一行对应一个远端实例，`(mailbox_id, uid_validity, uid)` 唯一；
  账号与文件夹复合外键防错关联，不以 Message-ID 去重。保存邮件头、服务器标志、大小，
  以及数据库文字正文 `body_text`、原始 HTML `body_html` 和 `body_version`。
  `body_text IS NULL` 或旧 `body_version=0` 为待补齐，空字符串且版本 1 也可表示已确认的空正文。
- `mail_attachment`：邮件附件元数据、大小及 SHA-256 内容引用；实际内容在数据目录的哈希分桶，
  从不把远端文件名拼进缓存路径。
- 单次 FETCH/事务至多 100 个 UID，头与进度一并提交；只有 FETCH 成功才删除该区间已消失 UID。
- 首次优先末端窗口，历史通过可恢复的扫描补齐；压缩 UID 搜索集合与本地索引共同跳过空洞，
  不展开百万 UID 区间。不完整批次约 5 秒继续，空闲约 5 分钟轮询，尚无 IDLE。
- UIDVALIDITY 改变只清该文件夹远端缓存和游标，不动账号、凭据或其他账号数据。
- 后台同步自动分批补齐未打开邮件的正文与历史摘要，按数据库待办断点继续；
  当前版正文不重复下载。`Cached` 仅为本地正文具备状态，不意味着临时缓存或正文文件。
  前台仍保留读取和显式重取入口；网络 literal 上限 40 MiB，文本上限 1 MiB、单附件 25 MiB、部件数有界。
  附件在解码时流式写临时文件并计算哈希；租约保护其他未提交下载，失败回收临时/未引用内容。
  这是按整封获取，不是逐附件远端 FETCH；导出缓存附件仍有内存读取上限。
- 文字/HTML 事务写入 SQLite，图片/附件二进制保留文件引用。读取正文不依赖正文缓存文件，
  图片不可读则降级图片，不清除数据库文字。原始 HTML 重新清洗后展示，不执行邮件脚本或自动请求外部图片；
  发送目前只支持纯文本，DATA 不确定结果不自动重发。
- 该存储是服务器镜像，不是永久归档；服务器确认删除和 UIDVALIDITY 改变仍沿用既有核对政策。
- 详见 [TASK-0058](../../07-tasks/active/TASK-0058-offline-mail-persistence.md) 与
  [ADR-0008](../adr/ADR-0008-offline-mail-bodies.md)；没有宣称超预算正文或所有历史数据均已下载。
- 已删除缓存的历史孤立内容尚无全量 GC/配额策略；不把临时下载补偿等同于完整垃圾回收。

# 当前数据库结构：账号存储 v1

> 状态：已实现，待评审 | 最后更新：2026-10-27
> 任务：[TASK-0030](../../07-tasks/active/TASK-0030-account-storage-foundation.md)

## 1. 权威来源

- 真实结构：[0001_accounts.sql](../../../internal/repository/migrations/0001_accounts.sql)。
- 数据库打开、身份校验及连接设置：[sqlite.go](../../../internal/repository/sqlite.go)。
- 迁移执行：[migrations.go](../../../internal/repository/migrations.go)。
- 输入校验与领域接口：[account.go](../../../internal/domain/account.go)。
- 账号读写：[account.go](../../../internal/repository/account.go)、
  [account_read.go](../../../internal/repository/account_read.go)。

不复制另一份 DDL；本文用于说明语义，SQL 和测试为实际约束来源。
旧 [schema.md](schema.md) 中的邮件表和示例尚未实施，不是数据库当前版本。

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

- 记录 `version`、`applied_at`、`checksum`；初始版本为 1。
- 初次空库初始化、迁移及历史记录在同一事务提交。
- 校验和使用完整 SQL 文件归一化 CRLF 为 LF 后的 SHA-256；包含 up/down，不能改写已应用迁移。
- 已知数据库丢失历史、历史缺号、未知更高版本、校验不符时拒绝继续迁移。
- 非空已知库存在待应用版本时，先用 `VACUUM INTO` 创建唯一命名的升级前快照；
  初次初始化与无升级的普通启动不创建备份。
- 不自动执行 down，不自动修复历史，不删除或覆盖用户数据库。

## 6. 账号移除与凭据边界

- `DisconnectAccount`：保留账号与连接，停用同步、置为 `disconnected`、清空凭据引用。
- `DeleteAccount`：仅删除该账号及其连接，不发送服务器删除命令。
- 两者返回事务提交时已无其他引用的凭据引用，且去重排序。它们**不执行 OS 凭据删除**；
  后续服务层须串行编排、处理失败补偿，并避免旧引用被重新使用时误删。
- 修改凭据时，后续服务层负责新引用保存、更新失败补偿及旧条目回收；当前仓储不接收秘密。
- 未建立邮件表，所以“保留数据”目前验证到账号及连接；邮件及附件清理需后续独立测试。

## 7. 服务商扩展

只在 [provider.go](../../../internal/domain/provider.go) 的 `ProviderPresets()` 增加定义并补测试，
不修改迁移、SQL 服务商约束或账号仓储。现有 Gmail、QQ、网易 163、网易 126、自定义预设
均返回独立配置；保存的是账号连接快照，后续修改预设不影响已保存账号。

预设不是自动发现或服务商兼容性认证：本轮没有访问真实邮箱，不保证特定账号已经启用
IMAP 或满足授权政策。Gmail 优先 OAuth2；QQ、网易的密码类认证通常使用服务商授权码。
当前预设尚未接入 UI，品牌展示资源和认证说明随账号向导另行补充。
“新增预设无需迁移”适用于现有 IMAP/SMTP 和密码类/OAuth2 模型；新增协议或认证机制需另外评审。

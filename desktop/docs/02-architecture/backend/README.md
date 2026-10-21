# Go 后端架构

> 状态：草稿 | 负责人：@arch-lead | 最后更新：2026-10-15
> 相关：[总体架构](../overview.md) · [前端](../frontend/README.md) · [数据库](../database/README.md)

---

## 1. 包职责

| 包 | 职责 | 允许依赖 |
| --- | --- | --- |
| `app` | 应用装配、窗口/菜单、生命周期、单实例 | bridge, config, logger, platform, service |
| `bridge` | 暴露给前端的绑定方法（薄适配层） | service, domain |
| `service` | 业务用例：账号、邮件、草稿、同步、搜索 | domain, repository(接口), config, logger, platform |
| `repository` | SQLite / 文件 / 钥匙串的具体实现 | domain, logger |
| `domain` | 纯模型、接口、领域错误 | 标准库 |
| `config` | 配置结构、加载、校验、默认值 | domain(可选) |
| `logger` | 结构化日志、字段脱敏、轮转 | 标准库 |
| `platform` | OS 相关能力实现 | domain |

依赖单向：`app → bridge → service → repository → domain`，`domain` 不反向依赖任何包。

## 2. 关键接口（domain 层定义）

```go
package domain

type AccountRepository interface {
    Create(ctx context.Context, a Account) error
    List(ctx context.Context) ([]Account, error)
    Get(ctx context.Context, id string) (Account, error)
    Delete(ctx context.Context, id string, purge bool) error
}

type MailRepository interface {
    UpsertBatch(ctx context.Context, mails []Mail) error
    Page(ctx context.Context, q MailQuery) ([]MailListItem, string, error)
    SetFlags(ctx context.Context, ids []string, f FlagPatch) error
    GetBody(ctx context.Context, id string) (MailBody, error)
}

type SyncStateRepository interface {
    Load(ctx context.Context, accountID, mailbox string) (MailboxState, error)
    Save(ctx context.Context, s MailboxState) error
}

type PendingOpRepository interface {
    Enqueue(ctx context.Context, op PendingOp) error
    Lease(ctx context.Context, accountID string, n int) ([]PendingOp, error)
    Fail(ctx context.Context, id int64, err error, backoff time.Duration) error
    Done(ctx context.Context, id int64) error
}

type Indexer interface {
    Index(ctx context.Context, mailID string) error
    Delete(ctx context.Context, mailID string) error
    Search(ctx context.Context, q SearchQuery) (SearchResult, error)
}

type CredentialStore interface {
    Set(ctx context.Context, ref string, secret []byte) error
    Get(ctx context.Context, ref string) ([]byte, error)
    Delete(ctx context.Context, ref string) error
}

type Notifier interface {
    Notify(n Notification) error
}
```

## 3. Service 层编排

### 3.1 MailService

```go
type MailService struct {
    repos    MailRepository
    accounts AccountRepository
    index    Indexer
    sync     *SyncService
    events   EventSink
}

// 列表读取：只走本地，不阻塞于网络
func (s *MailService) Page(ctx context.Context, q MailQuery) (Page, error)

// 状态变更：本地先行 + 入队回写
func (s *MailService) SetRead(ctx context.Context, ids []string, read bool) error
```

原则：**读本地、写本地先行、网络异步**。UI 永远不被网络阻塞。

### 3.2 SyncService

见 [FEAT-0004](../../01-product/features/FEAT-0004-sync-engine.md)。结构：

```go
type SyncService struct {
    workers  map[string]*accountWorker
    sched    *scheduler
    maxConns chan struct{}   // 全局连接信号量，cap=3
}
```

- `accountWorker` 内部状态机串行处理该账号的一切 IMAP 操作（一个账号只有一个连接）。
- 调度器监听：启动、定时（可配 1-15 分钟）、手动、网络恢复、IDLE 通知。

### 3.3 ComposeService

草稿版本乐观锁、附件暂存、SMTP 发送与失败分类，见 [FEAT-0003](../../01-product/features/FEAT-0003-compose-send.md)。

### 3.4 SearchService

查询解析 -> FTS5 -> 结果组装与高亮，见 [FEAT-0005](../../01-product/features/FEAT-0005-local-search.md)。

## 4. bridge 层规范

```go
// bridge/mail_bridge.go
type MailBridge struct{ svc *service.MailService }

func (b *MailBridge) Page(q MailQueryDTO) (PageDTO, *APIError) {
    ctx := context.Background()
    p, err := b.svc.Page(ctx, q.toDomain())
    if err != nil {
        return PageDTO{}, toAPIError(err)
    }
    return fromDomainPage(p), nil
}
```

- 每个方法：参数 DTO -> domain -> 调用 service -> 结果 DTO。
- 捕获 panic（`defer recover()`），转 `APIError{Code:"INTERNAL"}`，并记 error 日志。
- 命名与前端类型一一对应，改动需同步 [04-development/api](../../04-development/api)。
- 长任务的取消：`ctx` 由 `app` 注入的 `context.WithCancel` 派生，进程退出时统一取消。

## 5. 事件总线

```go
type EventSink interface {
    Emit(name string, payload any)
}
// 实现包装 runtime.EventsEmit，避免 service 直接依赖 Wails 包
```

事件名约定：`mail:new`、`mail:updated`、`sync:state`、`sync:progress`、`account:changed`、
`notify:activated`、`ops:failed`。

## 6. 配置

```go
type Config struct {
    DataDir      string        `json:"dataDir"`
    LogLevel     string        `json:"logLevel"`
    CloseToTray  bool          `json:"closeToTray"`
    Theme        string        `json:"theme"`        // light|dark|system
    PollInterval int           `json:"pollInterval"` // 秒，默认 300
    Notify       NotificationPolicy `json:"notify"`
}
```

- 加载顺序：默认值 → 配置文件 → 环境变量 `OMNIMAIL_*` → 命令行（如 `--data-dir`）。
- 校验失败不启动，弹窗给出具体字段（避免"启动了但什么都不对"）。
- 写回采用原子替换（临时文件 + rename）。

## 7. 测试边界

| 层 | 测法 |
| --- | --- |
| domain | 纯单元测试，覆盖全部不变量 |
| service | 假 repository（内存实现）+ 假 IMAP/SMTP 服务器 |
| repository | 真实 SQLite（`t.TempDir()`），验证 SQL 与迁移 |
| bridge | 集成测试，校验 DTO 映射与错误码 |
| platform | OS 相关，仅冒烟（手动检查单） |

## 8. 性能约束

- 列表查询不得 N+1：账号/文件夹信息随行返回或预加载。
- 邮件正文按需加载（`GetBody`），列表只取摘要，减少 90% 的 IO。
- 解析与索引在独立 goroutine，批量 200 条提交一次事务。
- 内存中不保留全量邮件对象；列表用游标分页。

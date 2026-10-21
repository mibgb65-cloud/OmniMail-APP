# Sync API

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[FEAT-0004 同步引擎](../../01-product/features/FEAT-0004-sync-engine.md)

---

## Sync.Status

```ts
Status(): Promise<AccountSyncState[]>
```

```ts
interface AccountSyncState {
  accountId: string;
  state: 'idle' | 'connecting' | 'syncing' | 'backoff' | 'error' | 'disabled';
  currentMailbox: string | null;
  done: number;                  // 当前文件夹已处理数
  total: number;                 // 预计总数（可能为 0 表示未知）
  lastSyncAt: number | null;
  nextRetryAt: number | null;    // backoff 时有效
  error: { code: string; message: string } | null;
}
```

## Sync.Sync

```ts
Sync(accountId?: string | null): Promise<void>
```

- `null` 或不传：触发全部启用账号（受全局并发上限 3 约束，超出部分排队）。
- 已在同步中的账号：忽略重复触发（不报错）。
- 返回时表示"已接受任务"，不等待同步完成；进度经 `sync:progress` 事件推送。

## Sync.Cancel

```ts
Cancel(accountId: string): Promise<void>
```

- 取消该账号当前同步，状态回到 `idle`；已拉取的数据保留（下次增量继续）。
- 取消后仍需保证 IMAP 连接被正确关闭（`LOGOUT` + `Close`）。

## 事件

| 事件 | 负载 | 说明 |
| --- | --- | --- |
| `sync:state` | `{ accountId, state, error? }` | 状态机变化时 |
| `sync:progress` | `{ accountId, mailbox, done, total }` | 节流 ≥ 200ms |
| `mail:new` | `{ accountId, count }` | 拉取到新邮件时（每批一次） |
| `mail:updated` | `{ ids, patch }` | 回写成功时同步本地状态 |
| `ops:failed` | `{ accountId, kind, message }` | 离线操作进入失败队列 |

事件订阅示例：

```ts
useEffect(() => {
  const off = EventsOn('sync:state', (e: SyncStateEvent) => {
    syncStore.set(e.accountId, e.state, e.error);
  });
  return off;
}, []);
```

## 调度参数（服务端配置）

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `pollInterval` | 300s | 不支持 IDLE 时的轮询间隔（可设 60-900） |
| `maxConcurrentAccounts` | 3 | 全局并发连接上限 |
| `batchSize` | 200 | 单次 FETCH 批量 |
| `backoff` | 1s→5min | 指数退避 + ±20% 抖动 |
| `authRetryLimit` | 3 | 认证失败连续次数上限，达到后进 `disabled` |

## 手动同步 vs 自动同步

| 来源 | 行为差异 |
| --- | --- |
| 用户手动 | 跳过 `not_before`，立即执行；若在 backoff 中则重置退避 |
| 定时触发 | 遵守退避与配额 |
| 网络恢复 | 立即触发全部启用账号 |
| IDLE 通知 | 仅同步被通知的文件夹 |

## 注意

- 不要在 UI 中用 `Sync.Sync` 做轮询刷新——本地数据变更应靠事件。
- 频繁手动同步会被服务商限流（部分服务商 15 分钟内连接数限制），UI 建议 10s 冷却。

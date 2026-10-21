# 前端数据流与状态管理

> 状态：草稿 | 负责人：@frontend-lead | 最后更新：2026-10-15
> 相关：[前端架构](README.md) · [API 契约](../../04-development/api/README.md)

---

## 1. 原则

1. **单一写入源**：Go 侧 SQLite 是事实来源；前端 store 只是镜像 + 乐观变更。
2. **事件优先于轮询**：所有变化经 `sync:*` / `mail:*` 事件推送，前端不轮询。
3. **乐观更新**：用户操作立即反映，失败回滚并提示。
4. **可取消**：所有异步请求带 `requestId`，过期响应丢弃。

## 2. Store 划分

| Store | 内容 | 生命周期 |
| --- | --- | --- |
| `accountStore` | 账号列表、当前筛选账号 | 应用级 |
| `mailStore` | 当前列表（游标、items、选中项）、未读数 | 应用级 |
| `detailStore` | 当前打开的邮件正文缓存（LRU 20 条） | 应用级 |
| `syncStore` | 各账号同步状态、进度 | 应用级 |
| `composeStore` | 打开的草稿窗口集合与脏状态 | 应用级 |
| `uiStore` | 面板宽度、主题、Toasts、快捷键帮助 | 应用级 |

组件本地状态只放：输入框临时值、hover、展开/折叠等瞬态。

## 3. 读取流程（示例：列表分页）

```ts
// features/mail/hooks/useMailList.ts
export function useMailList(query: MailQuery) {
  const { items, cursor, status, append, reset } = useMailStore();

  useEffect(() => {
    reset();
    let cancelled = false;
    setStatus('loading');
    bridge.mail
      .page({ ...query, cursor: undefined })
      .then((r) => {
        if (cancelled) return;           // 丢弃过期响应
        append(r.items, r.nextCursor);
        setStatus('success');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(toUserMessage(e));
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [query.accountId, query.mailbox, query.keyword]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const r = await bridge.mail.page({ ...query, cursor });
    append(r.items, r.nextCursor);
  }, [cursor, query]);

  return { items, status, loadMore };
}
```

## 4. 写入流程（示例：标记已读）

```ts
async function toggleRead(ids: string[], read: boolean) {
  const snapshot = useMailStore.getState().patchMany(ids, { isRead: read }); // 乐观
  try {
    await bridge.mail.setRead(ids, read);
  } catch (e) {
    useMailStore.getState().restore(snapshot);                              // 回滚
    toast.error(toUserMessage(e));
  }
}
```

回滚策略：整批回滚（简化语义），不做逐条部分回滚。

## 5. 事件处理

```ts
// lib/bridge/events.ts
type Handlers = {
  'mail:new': (e: { accountId: string; count: number }) => void;
  'mail:updated': (e: { ids: string[]; patch: Partial<MailListItem> }) => void;
  'sync:state': (e: { accountId: string; state: SyncState }) => void;
  'sync:progress': (e: { accountId: string; mailbox: string; done: number; total: number }) => void;
  'ops:failed': (e: { accountId: string; kind: string; message: string }) => void;
};

const bus = createEventBus<Handlers>();

export function initBridgeEvents() {
  EventsOn('mail:new', (p) => bus.emit('mail:new', p));
  // ...
  return () => { /* 卸载时取消全部订阅 */ };
}
```

- 事件在 `main.tsx` 中初始化一次，卸载时统一清理（HMR 场景也要清理）。
- 事件处理中不做重 IO；需要拉取数据时进入微任务并做 100ms 合并（多封新邮件合并一次刷新）。

## 6. 缓存与失效

| 数据 | 缓存 | 失效时机 |
| --- | --- | --- |
| 邮件列表 | store 内保留当前分页 | 切换筛选、收到 `mail:new/updated` |
| 邮件正文 | LRU 20 条 | 账号移除、手动清缓存 |
| 文件夹树 | 每次账号同步完成刷新 | `sync:state → idle` |
| 未读数 | 由事件增量维护 | 启动时全量校准一次 |

## 7. 并发与竞态

- 每个列表查询带自增 `requestId`，只有最新 `requestId` 的结果入库。
- 同一草稿的保存请求串行（队列），避免版本冲突。
- 搜索输入：debounce 150ms；输入变化时 `AbortController` 丢弃旧请求。

## 8. 调试

- 开发模式暴露 `window.__MAIL_DEBUG__ = { stores, bus }`，仅 `import.meta.env.DEV` 生效。
- store 变更可在 Redux DevTools 兼容模式下观察（zustand middleware `devtools`）。
- 事件流水在开发模式下打到 console（`[event] mail:new {...}`），生产构建剔除。

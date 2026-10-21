# API 契约

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[后端架构](../../02-architecture/backend/README.md) · [前端数据流](../../02-architecture/frontend/data-flow.md)

---

## 1. 通信方式

桌面端没有 HTTP API。前端通过 Wails 生成的绑定调用 Go：

```ts
// frontend/src/lib/bridge/mail.ts
import { Mail } from '../../../wailsjs/go/bridge/MailBridge';
export const mail = {
  page: (q: MailQuery) => Mail.Page(q),
  setRead: (ids: string[], read: boolean) => Mail.SetRead(ids, read),
};
```

- 调用是 Promise；Go 侧返回 `(DTO, *APIError)`，`APIError` 非空时 Promise reject。
- 事件：`window.runtime.EventsOn(name, cb)`。
- 所有结构必须 JSON 可序列化。

## 2. 通用约定

| 项 | 约定 |
| --- | --- |
| 字段命名 | camelCase（JSON tag） |
| 时间 | Unix 毫秒整数；展示层格式化 |
| ID | ULID 字符串 |
| 枚举 | 小写下划线字符串，如 `mark_read` |
| 空值 | 用 `null`，不用 `"null"`/`""` 混用 |
| 分页 | 游标 `cursor`，不提供 offset |
| 批量上限 | 单次 ≤ 200 个 ID |

## 3. 错误结构

```json
{
  "code": "AUTH_INVALID",
  "message": "账号或密码不正确，请检查后重试",
  "detail": "imap: AUTHENTICATIONFAILED (host=imap.example.com)"
}
```

| code | 含义 | 前端处理 |
| --- | --- | --- |
| `VALIDATION` | 参数不合法 | 表单字段标红 |
| `NOT_FOUND` | 目标不存在 | 刷新列表 + 提示 |
| `AUTH_INVALID` | 凭据无效 | 引导重新授权 |
| `AUTH_EXPIRED` | 令牌过期 | 静默刷新，失败则引导 |
| `NETWORK` | 网络不可达 | 提示离线，入队重试 |
| `TIMEOUT` | 超时 | 提示 + 重试 |
| `CONFLICT` | 版本冲突（草稿） | 提示重新加载 |
| `STORAGE` | 磁盘/数据库错误 | 提示磁盘空间或恢复备份 |
| `LIMIT_EXCEEDED` | 超出限制（附件数等） | 明确限制值 |
| `INTERNAL` | 未预期错误 | 通用提示 + 上报日志 |
| `UNSUPPORTED` | 当前平台不支持 | 隐藏或禁用入口 |

## 4. 方法清单

详细字段见各模块文档：

| 模块 | 方法 | 文档 |
| --- | --- | --- |
| Account | `Probe` `Create` `List` `Update` `Remove` | [account.md](account.md) |
| Mail | `Page` `GetBody` `SetRead` `SetStarred` `Move` `Delete` | [mail.md](mail.md) |
| Compose | `Save` `Send` `ListDrafts` `Discard` | [compose.md](compose.md) |
| Sync | `Status` `Sync` `Cancel` | [sync.md](sync.md) |
| Search | `Query` | [search.md](search.md) |
| Settings | `Get` `Update` `ExportLogs` `OpenDataDir` | [settings.md](settings.md) |
| App | `Version` `OpenExternal` | [settings.md](settings.md#app) |

## 5. 事件清单

| 事件 | 负载 | 触发 |
| --- | --- | --- |
| `mail:new` | `{ accountId, count }` | 同步到新邮件 |
| `mail:updated` | `{ ids: string[], patch: Partial<MailListItem> }` | 状态变更（本地或服务器回写） |
| `account:changed` | `{ accountId, action }` | 增删改账号 |
| `sync:state` | `{ accountId, state, error? }` | 账号同步状态变化 |
| `sync:progress` | `{ accountId, mailbox, done, total }` | 同步进度（≥200ms 节流） |
| `ops:failed` | `{ accountId, kind, message }` | 离线操作永久失败 |
| `notify:activated` | `{ accountId, mailId }` | 用户点击系统通知 |

## 6. 版本兼容

- 绑定方法与字段的破坏性变更必须提升 MINOR/Major 并在 [changelog](../../08-history/changelog.md) 标注。
- 新增可选字段是兼容的；重命名字段需保留别名一个版本周期。
- 生成的 `wailsjs/` 与手写 DTO 不一致时以 Go 为准，前端类型需同步更新并跑 `typecheck`。

## 7. Mock 与联调

前端可用 `lib/bridge/mock.ts` 在无 Go 环境下渲染（`VITE_BRIDGE=mock`）：

```ts
if (import.meta.env.VITE_BRIDGE === 'mock') {
  return mockMailBridge;
}
```

Mock 数据放 `frontend/src/lib/bridge/__fixtures__/`，需覆盖：空列表、1000 条列表、
超长主题、含附件、中文+英文混排。

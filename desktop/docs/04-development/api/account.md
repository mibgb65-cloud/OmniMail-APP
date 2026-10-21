# Account API

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[FEAT-0001](../../01-product/features/FEAT-0001-account-onboarding.md) · [API 契约](README.md)

---

## Account.Probe

只校验连通性与认证，不落库、不存凭据。

```ts
Probe(input: ProbeInput): Promise<ProbeResult>
```

```ts
interface ProbeInput {
  email: string;                 // 完整邮箱地址
  imap: ServerCfg;
  smtp?: ServerCfg;              // 省略则只校验 IMAP
  authKind: 'password' | 'oauth2';
  password?: string;             // authKind=password 时必填
}

interface ServerCfg {
  host: string;
  port: number;
  security: 'ssl' | 'starttls' | 'none';
}

interface ProbeResult {
  ok: boolean;
  mailboxCount: number;          // 可读文件夹数（成功时）
  capabilities: string[];        // 服务器能力，如 ["IDLE","CONDSTORE","QRESYNC"]
  error?: APIError;              // ok=false 时给出
  elapsedMs: number;
}
```

错误码：`VALIDATION` `AUTH_INVALID` `AUTH_REQUIRED_OAUTH` `TIMEOUT` `NETWORK` `UNSUPPORTED`。
超时 10s（IMAP），SMTP 单独 10s。

## Account.Create

```ts
Create(input: CreateAccountInput): Promise<Account>
```

```ts
interface CreateAccountInput {
  email: string;
  displayName: string;
  provider: string;              // 'gmail' | 'outlook' | 'qq' | '163' | 'icloud' | 'custom'
  authKind: 'password' | 'oauth2';
  imap: ServerCfg;
  smtp: ServerCfg;
  password?: string;
  oauth?: { accessToken: string; refreshToken: string; expiresAt: number };
}
```

- 服务端行为：`Probe` 成功 -> 写入 `account` 行（`credential_ref` 指向钥匙串）-> 存凭据 ->
  异步触发首次同步（不等同步完成即返回）。
- 失败：任一步失败整体回滚（DB 行与凭据都不留）。

```ts
interface Account {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  authKind: 'password' | 'oauth2';
  enabled: boolean;
  colorIndex: number;            // 0..5
  createdAt: number;
  lastSyncAt: number | null;
  syncState: 'idle' | 'syncing' | 'error' | 'disabled';
}
```

## Account.List

```ts
List(): Promise<Account[]>
```

按 `createdAt` 升序。不返回任何凭据字段。

## Account.Update

```ts
Update(id: string, patch: UpdateAccountPatch): Promise<Account>
```

```ts
interface UpdateAccountPatch {
  displayName?: string;
  enabled?: boolean;
  colorIndex?: number;
  imap?: ServerCfg;
  smtp?: ServerCfg;
  password?: string;             // 提供则更新钥匙串
}
```

- 修改服务器参数会重置该账号的 `sync_state` 并需要重新校验（返回 `VALIDATION` 时不变更）。
- 停用账号（`enabled=false`）：停止同步，保留本地数据，不出现在统一收件箱。

## Account.Remove

```ts
Remove(id: string, purgeLocal: boolean): Promise<void>
```

- `purgeLocal=true`：删除账号、文件夹、邮件、索引、附件引用与文件、钥匙串条目。
- `purgeLocal=false`：仅删除账号与凭据，本地邮件行标记 `orphaned` 并保留 7 天后清理。
- 正在同步中：先取消 worker（≤3s），再执行删除。

## 示例

```ts
const probe = await bridge.account.probe({
  email: 'name@gmail.com',
  imap: { host: 'imap.gmail.com', port: 993, security: 'ssl' },
  smtp: { host: 'smtp.gmail.com', port: 465, security: 'ssl' },
  authKind: 'password',
  password: 'APP_PASSWORD',
});
if (!probe.ok) throw new BridgeError(probe.error!.code, probe.error!.message);
```

# Settings & App API

> 状态：草稿 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[配置](../../02-architecture/backend/README.md#6-配置) · [FEAT-0006](../../01-product/features/FEAT-0006-notification-tray.md)

---

## Settings.Get

```ts
Get(): Promise<AppSettings>
```

```ts
interface AppSettings {
  dataDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark' | 'system';
  closeToTray: boolean;
  pollInterval: number;          // 秒，60..900
  density: 'compact' | 'comfortable';
  panelWidths: { sidebar: number; list: number };
  notify: NotificationPolicy;
  credentialProtection: 'keychain' | 'dpapi' | 'none';  // 只读，展示当前保护级别
  telemetryEnabled: boolean;     // 默认 false
  version: string;
  dataUsageBytes: number;        // 本地数据占用，用于设置页展示
}

interface NotificationPolicy {
  enabled: boolean;
  accountIds: string[];          // 空 = 全部
  onlyImportant: boolean;
  keywords: string[];
  quietHours: { start: string; end: string } | null;  // "22:00" / "08:00"
  groupWindow: number;           // 秒，默认 60
}
```

## Settings.Update

```ts
Update(patch: Partial<AppSettings>): Promise<AppSettings>
```

- 只允许修改白名单字段：`logLevel theme closeToTray pollInterval density panelWidths notify telemetryEnabled`。
- `dataDir` 变更走独立方法 `Settings.MoveDataDir(newPath)`（需校验可写、空间充足、复制成功后切换）。
- 变更立即生效并持久化（原子写）；`theme` 变更同时广播到前端（前端也可自行即时切换，以设置持久化为准）。

## Settings.ExportLogs

```ts
ExportLogs(targetDir: string): Promise<{ path: string; bytes: number }>
```

- 导出最近 7 天日志，自动脱敏：邮箱地址 → `a***@example.com`，令牌/密码 → `***`。
- 输出 ZIP：`omnimail-logs-YYYYMMDD.zip`，包含 `app.log`、`system.json`（OS/版本/配置摘要，不含账号）。

## Settings.OpenDataDir

```ts
OpenDataDir(): Promise<void>
```

用系统文件管理器打开数据目录（`platform.Shell.OpenDir`）。

## Settings.Maintenance

```ts
RebuildIndex(): Promise<void>            // 后台重建全文索引
ClearCache(opts: { attachments: boolean; bodies: boolean; olderThanDays?: number }): Promise<{ freedBytes: number }>
Backup(now?: boolean): Promise<{ path: string }>
```

## App

```ts
Version(): Promise<{ version: string; commit: string; buildTime: string; wails: string }>
OpenExternal(url: string): Promise<void>   // 仅 http/https/mailto
Quit(): Promise<void>                      // 冲刷数据后退出
```

## 错误码补充

| code | 场景 |
| --- | --- |
| `STORAGE` | 数据目录不可写、空间不足（附所需/可用空间） |
| `UNSUPPORTED` | 平台不支持该能力（如 Linux 托盘） |
| `VALIDATION` | 非法字段或超范围（`pollInterval < 60`） |

## 示例

```ts
const s = await bridge.settings.get();
await bridge.settings.update({ theme: 'dark', notify: { ...s.notify, enabled: true } });
```

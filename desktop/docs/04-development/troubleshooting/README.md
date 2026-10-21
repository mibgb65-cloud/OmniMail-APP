# 故障排查

> 状态：已生效 | 负责人：@backend-lead | 最后更新：2026-10-15
> 相关：[环境要求](../environment.md) · [快速开始](../getting-started.md)

---

## 1. 排查顺序（固定套路）

```
1. 看日志：数据目录/logs/app.log（最近 200 行）
2. 定位阶段：启动 / 配置 / 数据库 / 网络 / 渲染
3. 缩小范围：单账号复现？新数据目录复现？
4. 记录：错误码 + 时间点 + 复现步骤（写入 issue 或 bug-report）
5. 修复后补回归用例
```

日志关键字段：`ts` `level` `msg` `account_id` `code` `cost_ms`。

---

## 2. 构建与依赖

### `wails: command not found`

```bash
go env GOPATH        # 确认 bin 目录
# Windows
$env:Path += ";$(go env GOPATH)\bin"
# macOS
export PATH="$PATH:$(go env GOPATH)/bin"
```

### `failed to build: exit status 1`（Windows）

- 检查 `wails doctor` 输出的 WebView2 状态。
- 若提示缺少 WebView2：`winget install Microsoft.EdgeWebView2Runtime`。
- 若提示 CGO：确认 `CGO_ENABLED=1` 且有 MSVC Build Tools；或切纯 Go SQLite 驱动（见 ADR 待决策）。

### 前端构建 OOM

```bash
export NODE_OPTIONS=--max-old-space-size=4096
```

### `go: module ... not found`

```bash
go clean -modcache && go mod download
```

---

## 3. 启动与运行

### 启动即退出（无窗口）

1. 查看 `logs/app.log` 首段错误。
2. 常见原因：数据目录不可写（`STORAGE`）、配置 JSON 解析失败、数据库迁移失败。
3. 用新目录验证是否为数据问题：

```bash
OMNIMAIL_DATA_DIR=/tmp/omnimail-fresh wails dev
```

### 单实例锁冲突

- 已有进程在运行；托盘右键退出或结束进程。
- 若进程已崩溃仍锁住：删除数据目录下 `instance.lock`（先确认无进程）。

### 白屏

| 原因 | 验证 | 处理 |
| --- | --- | --- |
| 前端资源未嵌入 | `wails build` 后再运行 | 重新构建；`go run` 不会更新嵌入资源 |
| JS 运行时报错 | 开 DevTools（开发模式） | 修前端错误 |
| WebView2 异常 | 系统其它 WebView 应用是否正常 | 修复/重装 WebView2 |

---

## 4. 数据库

### `database is locked`

```go
// 确认 PRAGMA busy_timeout = 5000 已生效
row := db.QueryRow("PRAGMA busy_timeout") // 期望 5000
```

- 多进程访问是设计外行为：检查是否有第二个实例（单实例锁失效）。
- 杀毒软件实时扫描（Windows）会加长持锁时间：把数据目录加入排除项。

### `SQLITE_CORRUPT`

```bash
sqlite3 omnimail.db "PRAGMA quick_check;"
sqlite3 omnimail.db "PRAGMA integrity_check;"
```

- 通常由非正常关机/磁盘错误导致。按 [恢复流程](../../02-architecture/database/migrations.md#4-恢复流程) 处理。
- 不要尝试 `VACUUM` 一个已损坏的库作为唯一手段，先备份。

### 迁移失败

日志形如 `migration 0005 failed: ...`。
- 数据库已自动回滚该事务；联系维护者，附 `schema_migration` 表内容。
- 用户侧：恢复 `backups/pre-migration-v0005.db`。

---

## 5. 同步与网络

### `AUTH_INVALID`

- Gmail/Outlook 必须使用应用专用密码（或 OAuth），不能使用登录密码。
- QQ/163 需在服务商后台开启 IMAP/SMTP 并获取授权码。

### `NET_TIMEOUT` / `NETWORK`

```bash
# 连通性
Test-NetConnection imap.example.com -Port 993
telnet imap.example.com 143
```

- 公司网络常封 993/465：尝试 `STARTTLS` + 143/587。
- 代理环境：v1 不支持系统代理自动探测，需在系统级代理配置。

### 同步卡在 `connecting`

- 服务器不支持 `IDLE`，已退化为轮询。
- 连接数超限（部分服务商 5 连接/账号）：确认全局上限 3 生效，且无泄漏连接（看 `imap_conn_active`）。

### 邮件重复出现

- 检查唯一约束 `ux_mail_message(account_id, message_id)` 是否被正确命中。
- 部分服务商会重写 Message-ID（少见）；此时以 `(mailbox, uid)` 去重。

---

## 6. 渲染

### 邮件正文是空白

- 该邮件可能只有 `text/html` 且被清洗后为空：查 `blockedRemoteCount` 与原始 MIME。
- 用 `OMNIMAIL_IMAP_DEBUG=1` 抓取原始 MIME（注意脱敏）。

### 远程图片一直不显示

- 检查安全条按钮是否触发 `allowRemote`；确认并非被 CSP 拦截（DevTools Console 会报 CSP 违规）。

### 深色主题下正文刺眼

- 说明主题变量未注入 iframe：检查 `render` 时传入的 `Theme` 字段。

---

## 7. 打包与签名

| 现象 | 处理 |
| --- | --- |
| Windows 安装后无通知 | 未签名包可能被抑制；使用签名包或手动在系统设置允许 |
| macOS 打开提示"已损坏" | 未公证/未签名；用户需 `xattr -dr com.apple.quarantine`（仅内部测试） |
| 托盘图标不显示 | 图标尺寸/格式不符；确认 16/32px PNG 且非 0 通道 |
| 应用名显示为 "omnimail" | 缺少 `info.json` 产品名或 `Info.plist` CFBundleName |

---

## 8. 收集诊断信息（提供给维护者）

```bash
# 1. 版本信息
OmniMail --version
wails doctor > doctor.txt

# 2. 最近日志（应用内：设置 → 导出日志）
# 3. 数据库状态（只读）
sqlite3 omnimail.db "PRAGMA quick_check; SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1;"
# 4. 系统信息
systeminfo | Select-String "OS Name","OS Version","Total Physical Memory"
```

**不要**附带：邮件正文、附件、账号密码、OAuth 令牌。

# ADR-002：本地优先邮件后端架构与纯 Go 存储协议选型

状态：已采纳（2026-11-22）

## 背景与备选

OmniMail 需要从前端模拟数据演进为真实可用的多邮箱桌面客户端，同时坚持无中心化云账号、Local-First 本地多空间物理隔离与 Windows 零外部工具链构建。主要技术权衡包括：

1. **本地数据库**：`mattn/go-sqlite3` 依赖 CGO 与 MinGW/GCC，破坏纯 Go 编译；`modernc.org/sqlite` 为纯 Go 实现，内置 WAL 与 FTS5 `trigram` 分词器。
2. **大体积邮件与附件存储**：直接存入 SQLite BLOB 会导致单库膨胀与 WAL 锁竞争；内容寻址文件目录（CAS SHA-256 + `zstd` 压缩）可保持数据库轻量。
3. **凭据存储**：明文或固定密钥存在泄露风险；全局系统钥匙串难以做到多 Profile 物理隔离与随目录迁移。基于 Windows DPAPI（`CryptProtectData` + Profile 熵绑定）的独立 `secrets.vault` 兼顾安全与目录迁移。
4. **邮件协议与 HTML 安全**：采用 `emersion/go-imap/v2`、`go-smtp`、`go-message`、`go-ical` 纯 Go 协议栈，配合 `bluemonday` 入库白名单净化与外链图片默认重写拦截。

## 决定

- 引入纯 Go `modernc.org/sqlite`（强制 `CGO_ENABLED=0` 兼容），每个本地 Profile 拥有独立 `mail.db`（WAL + 外键 + FTS5 `trigram`）、`settings.json`、`secrets.vault` 与 `blobs/` 内容寻址存储。
- 采用 Windows DPAPI 加密当前 Profile 的 `secrets.vault`，本地空间锁采用 `argon2id` 派生校验，所有敏感凭据永不明文落盘、永不明文返回前端，日志与诊断包统一经过脱敏过滤器。
- 后端按职责拆分为 `desktop/internal/*` 领域包与 `desktop/services/*` Wails v3 薄门面服务；前端新增统一 `src/services/backendClient.ts` 适配层与集中事件总线，桌面态全面走真实后端，仅在纯浏览器 `pnpm dev` 下保留 Mock 兜底。

## 影响

- 构建链路继续保持零 CGO 依赖，`task verify` 与 `task build` 无需安装 C 编译器即可编译全部协议、压缩与全文检索能力。
- 多空间切换需由 `ProfileManager` 严格协调 `SyncManager`、`OutboxScheduler` 与 SQLite `wal_checkpoint(TRUNCATE)`，杜绝跨空间串台与文件句柄泄漏。

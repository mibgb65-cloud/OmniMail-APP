# TASK-20261124-017: 修复 QQ 邮箱增量同步持续报错、错误日志缺失与连接诊断盲区

## 状态
已完成并验证通过（2026-11-24）。

## 完成内容
1. **修复 `worker.go` & `worker_progress.go` 吞错与死连接雪崩**：
   - 新增 `desktop/internal/syncer/worker_reconnect.go`，实现连接级错误判定（`io.EOF`、`net.Error`、`imapclient` 连接关闭/重置/超时）、安全重连与脱敏文件夹故障摘要。
   - 更新 `worker.go` 与 `worker_progress.go`：每个文件夹同步失败时均调用 `AppendSyncLog(..., "IMAP", "error", "folder-sync", ..., "文件夹 <RemoteName> 同步失败", mbErr.Error())` 写入 `sync_logs` 与 `sync.log`；将真实脱敏错误透传至 `finishSyncProgress` 与 `reportStatus`，使 `accounts.last_error` 显示真实原因（如 `INBOX 同步失败: ...`）；当文件夹返回连接级错误时主动关闭旧连接并调用 `mailproto.ConnectIMAP` 建立新连接后再同步后续文件夹，避免单个文件夹断连拖垮 `Sent / Drafts / Junk / Trash`。
2. **增强 `worker_mailbox.go` & `mailbox_flags.go` 对 QQ 邮箱等非严格 RFC 服务端兼容性**：
   - 新增 `worker_mailbox_fetch.go` 与 `worker_mailbox_ingest.go`，重构 `worker_mailbox.go` 与 `mailbox_flags.go`：
     - **`UIDNext` 短路保护**：当 `prevLastUID > 0 && sel.UIDNext > 0 && uint32(sel.UIDNext) <= prevLastUID+1` 时直接跳过新 UID 拉取，不再发送易触发异常的 `UID FETCH (lastUID+1):*`。
     - **增量 UID 发现策略**：优先调用 `cli.UIDSearch(&imap.SearchCriteria{UID: []imap.UIDSet{newSet}}, nil).Wait()`，不支持时再安全回退 `UID FETCH` 并过滤 `<= prevLastUID` 与空结果。
     - **压缩标志同步范围并显式报错**：`mailbox_flags.go` 通过 `buildCompactUIDSet` 合并连续 UID 区间并按 50 封分片拉取标志，显式返回错误供调用方感知断连并重连。
     - **单封容错 + 断点推进 `last_uid`**：拉取正文附加超时保护；整批拉取失败时自动重连并降级为逐封拉取，记录单封失败日志（`stage="message-fetch"`）后继续同步其余邮件；增量同步按升序批次推进，每完成一个连续无失败的批次即实时推进 `remote_mailboxes.last_uid`，遇缺口则停止推进防止跳过未拉取邮件。
3. **强化连接诊断真实故障提示**：
   - 新增 `desktop/internal/diagnostics/diagnostics_inbox.go` 并更新 `diagnostics.go`：在 `RunAccountDiagnostics` 中补充轻量只读 `SELECT INBOX` 检测，并附加该账户最近尚未恢复的 `sync_logs` `error` 摘要，消除「顶部报错受阻但连接诊断显示一切正常」的割裂。
4. **单元测试与验证**：
   - 新增 `worker_mailbox_resilience_test.go`、`worker_mailbox_fallback_test.go` 及 `diagnostics_test.go` 用例，覆盖 `UIDNext <= prevLastUID+1` 短路、UID 连续区间压缩、单文件夹断连后重连不拖垮后续文件夹、错误详情落库 `sync_logs` / `accounts.last_error`、批量拉取失败降级逐封与断点推进 `last_uid`、以及连接诊断最近同步故障展示。
   - 全部新增与修改源码文件均严格控制在 200 行以内；`task verify` 全量通过（含 `go test ./...`、`go vet`、`go build` 与前端全量校验）。

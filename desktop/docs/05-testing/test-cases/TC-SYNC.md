# TC-SYNC 同步用例

> 状态：草稿 | 最后更新：2026-10-15 | 关联：[FEAT-0004](../../01-product/features/FEAT-0004-sync-engine.md)

---

### TC-SYNC-001 首次全量同步

- 级别：P0 | 状态：自动（`TestSync_Initial`）
- 前置：本地假 IMAP，INBOX 有 500 封
- 预期：
  - 500 封全部落库，`sync_state.uidNext` 与服务器一致
  - 索引条数为 500
  - 事件 `mail:new` 至少一次，进度单调递增

### TC-SYNC-002 增量同步仅拉新邮件

- 级别：P0 | 状态：自动（`TestSync_Incremental`）
- 步骤：服务器新增 3 封后触发同步
- 预期：仅处理 3 封；耗时显著低于首次（≤ 10%）；无重复行

### TC-SYNC-003 断网恢复自动继续

- 级别：P0 | 状态：自动（`TestSync_Reconnect`）
- 步骤：同步中断网 30s 后恢复
- 预期：10s 内状态 `backoff → syncing`；同步完成后 `lastSyncAt` 更新；无重复

### TC-SYNC-004 UIDVALIDITY 变化触发重建

- 级别：P0 | 状态：自动（`TestSync_UidValidityReset`）
- 步骤：服务端重建文件夹（UIDVALIDITY +1）
- 预期：
  - 该文件夹本地 `mail_mailbox` 行被替换（不残留旧 UID）
  - 用户标记（星标/已读）按 Message-ID 保留
  - 不产生重复邮件行（`ux_mail_message` 生效）

### TC-SYNC-005 认证失败不无限重试

- 级别：P0 | 状态：自动（`TestSync_AuthFailDisable`）
- 预期：连续 3 次 `AUTH_INVALID` 后账号进 `disabled`；UI 显示"需重新授权"；不再发起连接

### TC-SYNC-006 全局并发限制

- 级别：P1 | 状态：自动（`TestSync_ConcurrencyCap`）
- 前置：5 个账号同时触发
- 预期：同时活跃 IMAP 连接数 ≤ 3；其余账号排队并最终完成

### TC-SYNC-007 离线操作回写幂等

- 级别：P0 | 状态：自动（`TestPendingOps_Idempotent`）
- 步骤：同一封邮件离线切换已读 3 次，联网回写
- 预期：`pending_op` 合并为 1 条；服务器最终状态为最后一次；不重复执行

### TC-SYNC-008 永久失败进入失败队列

- 级别：P1 | 状态：自动
- 前置：服务器返回永久错误（如邮件已被删除）
- 预期：`failed_op` 有记录；UI Toast 提示；不阻塞后续操作

### TC-SYNC-009 同步中取消

- 级别：P1 | 状态：自动（`TestSync_Cancel`）
- 预期：3s 内状态回 `idle`；连接正确 `LOGOUT` 并关闭；已拉取数据保留

### TC-SYNC-010 进程重启不重复

- 级别：P0 | 状态：自动
- 步骤：同步到一半强杀进程后重启
- 预期：从游标继续；不出现重复邮件；损坏不产生（事务保证）

### TC-SYNC-011 IDLE 通知触发即时同步

- 级别：P1 | 状态：手动
- 预期：服务器推送 `EXISTS` 后 1s 内新邮件出现在列表

### TC-SYNC-012 限流退避

- 级别：P2 | 状态：自动
- 前置：服务器返回 `[THROTTLED]`
- 预期：按 1s→5min 退避，带抖动；不产生连接风暴

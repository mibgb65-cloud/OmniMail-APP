# TASK-20261124-012 · 邮件列表两级无缝续拉与远端 IMAP 历史回溯

- 状态：Completed
- 当前行为：`remote_mailboxes` 未记录 `oldest_uid` / `history_exhausted`，首次同步截断后无法按需向更早历史回溯；`ListMessages` 不返回远端余量；前端仅消费本地 `nextCursor`，无哨兵 `IntersectionObserver` 及 5 态底部 UI。
- 方案：后端补齐 SQLite 幂等迁移、历史游标追踪、IMAP 历史回溯 `LoadOlderMessages` 与 `hasRemoteMore`/`remoteTotalCount` 透传；前端实现「本地分页 → 远端回溯 + 尾部游标追加」两级续拉与对齐 OpenPencil `27 · 06` 规范的 5 态底部 UI（含 2 张骨架卡、亮暗双色、中英双语、防回顶胶囊遮挡）。

## 实现与验证

- **数据库迁移与同步游标**：
  - `desktop/internal/storage/schema_core.go`、`db.go`、`mailbox_cursor_migration.go`：幂等为 `remote_mailboxes` 新增 `oldest_uid` 与 `history_exhausted`（schema migration v3），老库自动从 `messages.remote_uid` 懒回填 `oldest_uid`，同时将 `RunMigrations` 改为按版本号独立检测，保证各版本迁移可单独幂等重入。
  - `desktop/internal/syncer/worker_mailbox.go`、`backfill_cursor.go`：首轮同步结束按实际覆盖与 `sel.NumMessages` 更新 `oldest_uid` 与 `history_exhausted`；`UIDValidity` 变化清库时一并重置 `oldest_uid = 0, history_exhausted = 0`。
- **按需远端 IMAP 历史回溯与余量透传**：
  - `desktop/internal/syncer/backfill.go`、`backfill_imap.go`、`manager.go`：新增 `Manager.LoadOlderMessages(ctx, accountID, folder, limit)`，支持单账号与统一收件箱回溯、`(accountID, folder)` 防重入锁、超时与会话取消保护；不受 90 天窗口限制查询 `1:(oldest_uid-1)` 并按 `syncBatchSize = 25` 拉取调用 `IngestMessage` 入库，抵达最早 UID 自动置 `history_exhausted = 1`。
  - `desktop/internal/search/dto.go`、`remote_more.go`、`query.go`：`MessageListPage` 新增 `hasRemoteMore` 与 `remoteTotalCount`；`services/account_service.go`（`SyncDriver`）与 `services/mail_backfill.go` 暴露 `MailService.LoadOlderMessages`，重新生成 Wails TypeScript bindings。
- **前端两级续拉与 5 态底部 UI**：
  - 更新 `types/mail.ts`（`receivedAtUnixMs`）、`services/mailMapper.ts`、`services/mailApi.ts`；新增 `state/mailListBackfillPolicy.ts` 与 `state/useMailLoadMore.ts`，升级 `state/useMailPages.ts` 与 `state/useMailStore.ts`，实现「本地 `nextCursor` 续拉 → 远端 `loadOlderMessages` 回溯 → 尾游标增量追加（绝不触发全量重载或滚动跳动）」，失败时阻断自动循环直至手动点「重试」。
  - `components/mail/MailListBody.tsx` 接入 `IntersectionObserver` 哨兵（`rootMargin: "0px 0px 240px 0px"`）+ `onScroll` 兜底；新增 `components/mail/MailListFooter.tsx`、`styles/mail-list-footer-tokens.css`、`styles/mail-list-footer.css` 与 `i18n/{zh,en}/mailListBackfill.ts`，完整覆盖 5 态（本地加载、2 张骨架卡 + 服务器回溯、手动兜底、失败重试、已到底分割线），位于 `.fade-scroll-content` 内自动兼容回顶胶囊 `padding-block-end: 56px` 防遮挡。
- **源码行数核验**：所有新增与修改的前后端源码文件均严格控制在 `<= 200` 行内。
- **验证结果**：新增 Go 单元测试（`mailbox_cursor_migration_test.go`、`backfill_test.go`、`remote_more_test.go`）与前端单测（`mail-list-backfill.test.mjs`）；执行 `task verify` 全量通过（`bindings`、`gofmt`、`prettier --check`、`eslint`、`tsc --noEmit`、`vite build`、52 项前端单测、`go vet`、`go test ./...`、`go build`）及生产前端构建 `pnpm --dir desktop/frontend build` 通过。
- **未验证事项**：按协作规则未启动原生桌面窗口联调真实邮局大收件箱人工滚动预览，未做发布包，未创建 Git 提交。

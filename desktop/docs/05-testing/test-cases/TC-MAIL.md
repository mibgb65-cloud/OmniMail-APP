# TC-MAIL 邮件用例

> 状态：草稿 | 最后更新：2026-10-15 | 关联：[FEAT-0002](../../01-product/features/FEAT-0002-unified-inbox.md) · [FEAT-0007](../../01-product/features/FEAT-0007-safe-html-render.md)

---

### TC-MAIL-001 统一收件箱按时间合并

- 级别：P0 | 状态：自动（`TestMailPage_Unified`）
- 前置：账号 A 有 3 封、账号 B 有 2 封（时间交错）
- 预期：5 封按 `receivedAt DESC` 排列；每行含正确 `accountLabel` 与 `colorIndex`

### TC-MAIL-002 游标分页无重复无遗漏

- 级别：P0 | 状态：自动（`TestMailPage_Cursor`）
- 前置：1000 封同一时间戳
- 步骤：连续分页至末尾
- 预期：共返回 1000 条唯一 ID；无重复；`nextCursor` 最终为 `null`

### TC-MAIL-003 标记已读（在线）

- 级别：P0 | 状态：自动
- 预期：本地立即变更并返回 `queued=1`；回写后服务器 `\Seen` 一致

### TC-MAIL-004 标记已读（离线）

- 级别：P0 | 状态：自动（`TestOfflineQueue_Flags`）
- 预期：UI 立即生效；`pending_op` 有记录；联网后自动回写；服务器一致

### TC-MAIL-005 恶意 HTML 不执行

- 级别：P0 | 状态：自动（`TestSanitize_XSS` + E2E）
- 前置：邮件含 `<script>alert(1)</script>`、`<img onerror=alert(1)>`、`<a href="javascript:alert(1)">`
- 预期：
  - 渲染后 iframe 内无 `<script>`、无 `on*` 属性
  - 点击链接无导航；日志记录 `blocked_nav`
  - 主窗口绑定未被调用

### TC-MAIL-006 跟踪像素被阻止

- 级别：P0 | 状态：自动（E2E + 网络抓包）
- 前置：邮件含 `<img src="http://tracker.example/1x1.gif">`
- 预期：打开邮件后未向 `tracker.example` 发起请求；安全条显示"已阻止远程内容"

### TC-MAIL-007 显示图片仅对发件域放行

- 级别：P1 | 状态：手动
- 预期：点击"显示图片"后仅该邮件域名图片加载；其它域仍被 CSP 拦截

### TC-MAIL-008 表单被剥离

- 级别：P0 | 状态：自动（`TestSanitize_Form`）
- 预期：`<form>`/`<input>` 不渲染；正文其余内容保留

### TC-MAIL-009 超大字内联资源

- 级别：P1 | 状态：自动（`TestRender_HugeInline`）
- 前置：20MB base64 图片
- 预期：渲染 < 500ms，内存峰值 < 80MB，超出上限时截断并提示

### TC-MAIL-010 批量操作上限

- 级别：P2 | 状态：自动
- 步骤：传入 201 个 ID
- 预期：返回 `VALIDATION`，无部分执行

### TC-MAIL-011 删除后撤销

- 级别：P1 | 状态：手动
- 预期：8 秒内点"撤销"恢复原文件夹；超时后不可撤销

### TC-MAIL-012 未读状态不依赖颜色

- 级别：P1 | 状态：手动（灰度模式检查）
- 预期：灰度下仍可通过字重与圆点区分未读

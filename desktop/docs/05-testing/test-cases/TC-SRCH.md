# TC-SRCH 搜索用例

> 状态：草稿 | 最后更新：2026-10-15 | 关联：[FEAT-0005](../../01-product/features/FEAT-0005-local-search.md) · [ADR-0003](../../02-architecture/adr/ADR-0003-sqlite-fts5.md)

---

### TC-SRCH-001 英文关键词命中

- 级别：P0 | 状态：自动（`TestSearch_Basic`）
- 前置：索引 1 万封，其中 37 封正文含 `invoice`
- 预期：返回 37 条；`matchedFields` 含 `body`；`elapsedMs` 正常记录

### TC-SRCH-002 中文二元命中

- 级别：P0 | 状态：自动（`TestSearch_ChineseBigram`）
- 前置：邮件含"季度报告"与"季度 报告"
- 步骤：查询"季度报告"、"报告"、"季度 报告"
- 预期：三次均命中两封；高亮包含命中词

### TC-SRCH-003 单字中文降级提示

- 级别：P1 | 状态：自动
- 步骤：查询"票"
- 预期：`shortTermWarning=true`；结果来自 LIKE 扫描（限当前账号）；UI 显示提示

### TC-SRCH-004 语法 `from:` 精确收窄

- 级别：P0 | 状态：自动
- 步骤：`from:zhang@example.com`
- 预期：仅该发件人；`matchedFields` 含 `from`

### TC-SRCH-005 组合语法

- 级别：P0 | 状态：自动
- 步骤：`from:zhang has:attachment after:2025-01-01 -退款`
- 预期：结果同时满足四项；排除项生效

### TC-SRCH-006 语法错误降级

- 级别：P1 | 状态：自动
- 步骤：输入 `from:`
- 预期：`degraded=true`；按整串字面量搜索；不抛错；UI 提示"已按完整文本搜索"

### TC-SRCH-007 跨账号检索

- 级别：P0 | 状态：自动
- 前置：3 个账号各含"发票"
- 预期：默认返回全部 3 账号结果；指定 `accountIds` 后仅返回对应

### TC-SRCH-008 删除后索引移除

- 级别：P0 | 状态：自动
- 步骤：搜索命中一封，删除该邮件后再搜索
- 预期：不再出现在结果中；FTS 无对应行

### TC-SRCH-009 性能 P95

- 级别：P1 | 状态：自动（bench）
- 运行：200 次随机查询
- 预期：P95 ≤ 120ms，P99 ≤ 250ms

### TC-SRCH-010 索引重建不卡 UI

- 级别：P1 | 状态：手动
- 步骤：设置 → 维护 → 重建索引
- 预期：后台执行，UI 可操作；期间搜索返回降级结果并提示；完成后恢复正常

### TC-SRCH-011 高亮安全

- 级别：P0 | 状态：自动
- 前置：邮件正文含 `<img src=x onerror=alert(1)>`
- 预期：片段中的 HTML 被转义，仅 `<mark>` 生效；无执行

### TC-SRCH-012 连续输入竞态

- 级别：P1 | 状态：自动（前端）
- 步骤：200ms 内输入 5 个字符
- 预期：只渲染最终查询的结果；无闪烁错序

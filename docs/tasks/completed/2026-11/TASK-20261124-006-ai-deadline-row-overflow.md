# TASK-20261124-006 · 修复 Omni AI 关键时间与待办长文本溢出

- 状态：Completed
- 当前行为：右侧 Omni AI 面板「关键时间与待办」条目（`.ai-deadline-row`）使用单行不换行布局，且右侧 `timeText` 设置了 `flexShrink: 0`；当模型返回较长 `timeText`（或本地已缓存长文本）时，左侧 `label` 被挤压至不可见，右侧红色/蓝色时间文字直接撑破卡片边界。同时后端摘要提示词未约束 `label` 与 `timeText` 的职责和字数。
- 方案：前端将摘要待办行改造为自适应折行展示并清洗空白条目；后端收紧摘要提示词中 `timeText` 的长度与语义要求并执行空白裁剪；前后端补充对应单测。
- 验证计划：运行 `pnpm test`、`tsc --noEmit`、`pnpm build`、`go test ./internal/ai/...` 与全量 `task verify`。

## 实现与验证

- 前端自适应折行与清洗：`autoMailSummary.ts` 新增 `normalizeSummaryDeadlines` 过滤空白项，`AiSummaryCard.tsx` 与 `ai-draft.css` 新增 `.ai-summary-deadline`、`.ai-deadline-label`、`.ai-deadline-time`，移除 `flexShrink: 0` 并启用 `flex-wrap: wrap` + `max-width: 100%` + `overflow-wrap: anywhere`；短时间保持单行左右对齐，本地已缓存超长文本自动折行完整展示，不再挤压左侧待办或溢出卡片，且不影响复用 `.ai-deadline-row` 的联系人往来记录。
- 后端提示词收敛：`desktop/internal/ai/mail_prompts.go` 明确限定 `timeText` 仅填 16 字以内的简短时间短语、补充说明归入 `summary`，并通过 `normalizeDeadlines` 在入库前裁剪空白与空项。
- 验证结果：新增前端单测（`tests/ai-sidebar.test.mjs`）与 Go 单测（`internal/ai/mail_actions_test.go`）；`pnpm build`（0 错误、0 警告）及全量 `task verify`（含 36 项前端测试、`go test ./...` 与开发构建）全部通过。
- 未验证事项：按协作规则未启动原生桌面窗口人工预览。
- 实现已提交：`10e54548e47b0574ccbed4ef1031e4c1ef2dc24f`，纳入 [Beta 9 本地安装包](TASK-20261124-010-windows-beta-9-local-release.md)。
- 关联：[架构](../../../architecture/OVERVIEW.md) · [测试与质量门](../../../development/TESTING.md)。

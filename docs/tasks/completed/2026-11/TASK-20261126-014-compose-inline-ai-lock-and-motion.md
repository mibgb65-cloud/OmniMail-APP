# TASK-20261126-014 · 写信内联 AI 升级（生成态严格输入锁定、只读协同保护与四层 60fps 流光动效）

- 状态：Completed
- 实现提交：未提交（待用户确认后提交）
- 范围：
  1. 对齐 OpenPencil `19 · 快捷交互与写信闭环` 新增的「写信内联 AI · 生成态锁定与高级动效规范」（亮色 `261906429:2381` / 暗色 `261906429:2574`），全面升级 `ComposeInlineAiBar` 与 `useInlineComposeAi`；
  2. 生成态严格锁定（`busy === true`）：自定义输入框 `disabled` + `aria-busy="true"` 并保留正在执行的指令文本与「输入已锁定」胶囊（空闲态展示可点击发送按钮）；4 枚预设按钮全部 `disabled`（当前触发项高亮 + 微脉冲点，其余降不透明度 `0.45`）；全程即时显示「停止生成 · Esc」（含 `reqId` 返回前抢停竞态保护）；按 `Escape`、点击「关闭」、最小化/丢弃草稿或切换 `draft.id` 时自动中止并清理在途流；
  3. 写信弹窗协同保护：标题栏展示「Omni AI 正在起草…」微光胶囊；`ComposeRichEditor` 切入温和只读保护态（「生成中暂只读 · 采纳前不会改动原正文」）；`ComposeFooterBar` 禁用「发送 / 定时发送」（含拦截 `Ctrl + Enter`）并提示「AI 生成完成后即可核对并发送」；
  4. 生成完成态闭环：解锁输入以支持继续追问微调，预览卡支持「✓ 替换当前正文」「+ 追加到末尾」「重新生成」「放弃」；
  5. 四层纯 CSS GPU 流光动效（`compose-inline-ai.css` + `compose-inline-ai-preview.css` + `compose-inline-ai-card.css`）：2.5px Aurora 顶栏光束、首字预热 3 行斜光骨架屏、1.5px 流光边框 + `FadeScroll` 自动吸底 + 呼吸光标、完成收敛绿标及 `prefers-reduced-motion` 无障碍静态降级；补齐中英词典与 `tests/compose-inline-ai.test.mjs` 单测。

## 关键实现

- **会话隔离与抢停控制器（`composeInlineAiLogic.ts` + `useInlineComposeAi.ts` + `useInlineComposeAiEvents.ts`）**：
  - 实现纯函数状态机 `createInlineAiSessionTracker`：即使在 `assistComposeStream` 返回 `reqId` 前点击「停止生成 · Esc」或切换草稿，返回后也会立即调用 `aiApi.cancelRequest(id)` 并丢弃残余流事件；
  - `busy` 期间捕获 `Escape`（`stopImmediatePropagation`）仅中止 AI 生成而不误收起写信弹窗；关闭内联栏、最小化/丢弃草稿或切换 `draft.id` 时自动取消在途请求。
- **协同保护与四操作采纳闭环（`ComposeModal.tsx` + `ComposeInlineAiBar.tsx` + `ComposeInlineAiPreview.tsx` + `ComposeRichEditor.tsx` + `ComposeFooterBar.tsx` + `ComposeToolbar.tsx`）**：
  - 将内联 AI 控制器提升至 `ComposeModal`，同步驱动顶栏微光胶囊、富文本只读保护条与底栏发送锁定；
  - 预览卡支持 `FadeScroll`（`max-height: 220px`）流式自动吸底（手动上滚时不强拉），完成后提供替换当前正文、空一行追加到末尾、按上次参数重新生成与放弃。
- **纯 CSS GPU 流光微动效与双语国际化**：
  - 新增 `src/styles/compose-inline-ai.css`、`src/styles/compose-inline-ai-preview.css`、`src/styles/compose-inline-ai-card.css`，以及 `src/i18n/{zh,en}/composeInlineAi.ts` 完整双语词典。

## 实际验证

- 单文件行数门禁：所有新增与修改的前端手写文件均严格 `<= 200` 行；
- `npm run typecheck` / `npm test` / `npm run build`：0 错误通过，前端 `121 / 121` 项单测（含新增 `tests/compose-inline-ai.test.mjs`）全部通过；
- `task verify`：全仓格式、ESLint、前端与 Go 测试及开发构建全部通过。

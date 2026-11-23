# TASK-20261123-008：封装并全端接入 AsyncActionButton 画勾闭环动效与 HandshakeSteps 四步握手步进条

## 状态
Completed

## 原始需求
参照 `OmniMail-redesign.fig` → `Motion & Transitions` 页面新增的 `06 · Async Loading & Checkmark Morph` 规范，封装通用异步交互组件 `AsyncActionButton.tsx` 与四步握手实时步进条 `HandshakeSteps.tsx`，并覆盖邮箱接入测连、连接诊断、AI 模型探测与保存、检查更新、数据目录迁移、安全备份导出、重要设置保存、顶栏同步状态胶囊与附件按需下载进度闭环。

## 实施范围与技术方案
1. **通用异步按钮与矢量状态原语（`src/components/common/AsyncActionButton.tsx`、`src/components/common/AsyncStateGlyph.tsx`）**：
   - 支持 `status: "idle" | "loading" | "success" | "error"`、`variant: "primary" | "secondary" | "danger"`、动态四态文案与 `successHoldMs`（默认 `900ms`）；
   - 进入非 `idle` 态前自动锁定初始 `offsetWidth` 为 `min-width` 消除跳宽，加载态采用 `aria-busy="true"` 拦截重复点击且保持高对比品牌色质感 + `2.2s` 表面柔和流光；
   - `AsyncStateGlyph` 采用 `viewBox="0 0 20 20"`、`r="7"`、`stroke-dasharray="30 44"` 双层环 `850ms` 旋转（或百分比确定进度环）→ `140ms` 外环闭合 + 脉冲光环 + `M6.2 10.3 L8.9 13 L14.2 7.5` 延迟 `90ms` 后 `260ms` 一笔画勾微弹 / 失败 `320ms ±4px` 轻抖画叉。
2. **动效与按钮双主题样式（`src/styles/buttons.css`、`src/styles/motion.css`、`src/styles/handshake.css`）**：
   - 仅动画化 `transform / opacity / stroke-dashoffset`，亮/暗双主题独立配比保障 WCAG AA+ 对比度，并在 `prefers-reduced-motion: reduce` 下关闭流光与微抖。
3. **四步握手实时步进条（`src/components/common/HandshakeSteps.tsx`）与高频场景全端接入**：
   - 邮箱测连与诊断：`ManualImapModal.tsx`、`ProviderGuideModal.tsx`、`AccountServerModal.tsx`（独立拆分并由 `OpsModals.tsx` 导出）、`DiagnosticsModal.tsx`；
   - 设置、更新、迁移与备份：`AiProviderCard.tsx`（`AiSettingsTab.tsx`）、`AccountDetailView.tsx`、`AutoReplyTab.tsx`、`UpdateFlowModal.tsx`、`DataDirMigrateModal.tsx`、`BackupMigrationModal.tsx`；
   - 顶栏同步胶囊与附件按需下载：`AppContext.tsx` + `TopBarSyncChip.tsx`（`TopBar.tsx`）、`AttachmentCardRow.tsx`（`ReaderAttachmentsSection.tsx`）。

## 验证结果
- `pnpm --dir desktop/frontend build`：`tsc --noEmit && vite build` 零错误通过（255 modules built）；
- `task verify`：`gofmt`、Prettier、ESLint、`tsc --noEmit`、`vite build`、`go vet ./...`、`go test ./...`、`go build` 全链路通过；
- `task build`：仅重新构建单个开发程序 `desktop/bin/omnimail.exe`（未构建生产/Beta 安装包）；
- 本次新增与修改的全部 28 个前端文件行数均严格控制在 `<= 200` 行以内。
- **未验证事项**：按协作规则未自动启动原生桌面窗口，紧随代码提交后按指令构建最新 Beta 生产安装包。
- **关联文档**：[产品范围](../../../product/PRD.md)、[当前状态](../../../plans/CURRENT.md)。
- **Git 提交**：实现提交 `4697c40`。

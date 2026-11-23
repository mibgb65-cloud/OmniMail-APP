# TASK-20261123-003：实现 0 邮箱冷启动空态四区联动与侧边栏占位卡交互

## 状态
Completed

## 原始需求
根据 `OmniMail-redesign.fig` → `08 · 空白与异常状态` 新增的「未接入邮箱（0 邮箱冷启动空态）· 亮/暗色」与「侧边栏占位卡交互规范」，实现 `accounts.length === 0` 时的四区联动优化，兼容亮/暗双主题与响应式布局。

## 实际改动
1. **左侧栏占位卡与窄屏 Icon Rail**：
   - `desktop/frontend/src/components/shell/SidebarAccountsAndLabels.tsx`（163 行）+ `desktop/frontend/src/styles/sidebar-accounts.css`（198 行）：当 `accounts.length === 0` 时渲染整卡可点击虚线占位卡（`28×28` 蓝底圆角 `+` 图标、「暂未接入邮箱」与「支持 Gmail / QQ / 163 / IMAP」、底部 `28px` 全宽「+ 添加第一个邮箱」轻按钮，基于设计令牌适配亮/暗默认态与蓝框蓝底悬停高亮），点击调用 `onNavigate?.()` 并打开 `add-account`；
   - `desktop/frontend/src/components/shell/SidebarIconRail.tsx`（156 行）+ `desktop/frontend/src/styles/drawers.css`（160 行）：0 邮箱时左下角胶囊切换为「+ 邮箱」（Tooltip「点击添加第一个邮箱」），点击直达 `add-account`。
2. **顶部状态胶囊联动**：
   - `desktop/frontend/src/components/shell/TopBar.tsx`（194 行）+ `desktop/frontend/src/styles/topbar.css`（198 行）：0 邮箱时状态点切换为中性灰点（亮 `#94A3B8` / 暗 `#64748B`）+「暂未接入邮箱」，点击直接打开 `add-account`。
3. **中间邮件列表空态区分**：
   - `desktop/frontend/src/components/mail/MailListPane.tsx`（196 行）+ `desktop/frontend/src/components/mail/MailListExtras.tsx`（136 行）+ `desktop/frontend/src/styles/mail-list.css`（163 行）：`accounts.length === 0` 时展示 `48×48` 蓝色圆角信封图标、「尚未接入任何邮箱」标题、汇总缓存说明与「+ 添加第一个邮箱」主按钮；`accounts.length > 0` 时完整保留原有 Inbox Zero / 搜索空态。
4. **右侧阅读区 0 邮箱快速接入引导卡**：
   - `desktop/frontend/src/components/mail/reader/MailReaderPane.tsx`（156 行）+ 新建 `desktop/frontend/src/components/mail/reader/ReaderZeroAccountGuide.tsx`（106 行）+ 新建 `desktop/frontend/src/styles/zero-account-guide.css`（159 行，于 `main.tsx` 引入）：`accounts.length === 0 && !selectedMail` 时居中展示 `max-width: 560px`、`border-radius: 18px` 的快速接入引导卡，包含顶部「本地优先 · 开源无云端账号」胶囊、主标题、动态活跃空间名副文案、6 个服务商快捷芯片（Gmail / Outlook 直达 `oauth-flow`、QQ 邮箱 / 网易 163/126 / iCloud 直达 `provider-guide`、通用 IMAP/SMTP 直达 `manual-imap`）、底部双按钮与 DPAPI 加密保护及本地空间切换快捷入口；
   - `desktop/frontend/src/data/providers.ts`（192 行）：补齐 `outlook` 本地目录预设兜底，确保直接点击 Outlook 快捷芯片打开弹窗时标题与服务器预设准确无误。

## 验证结果
- 已通过：`pnpm --dir desktop/frontend build`（`tsc --noEmit` + Vite 生产打包）0 错误通过；
- 已通过：`task verify`（Wails 绑定、`gofmt`、Prettier、ESLint、前端构建、`go vet`、`go test ./...`）全部通过；
- 已通过：`task build` 已重新构建开发程序 `desktop/bin/omnimail.exe`；
- 已通过：全部新增与修改文件均严格控制在 `<= 200` 行以内。
- 未验证事项：按协作规则未自动启动原生桌面窗口。
- 关联文档：[产品范围](../../../product/PRD.md)、[当前状态](../../../plans/CURRENT.md)。
- Git 提交：实现提交 `4697c40`。

# TASK-20261125-001 · 邮箱接入指引与授权弹窗双栏高保真重构

- 状态：Completed
- 当前行为：原有 `ProviderGuideModal`、`OAuthFlowModal`、`ManualImapModal` 均采用 `maxWidth={520~560}` 单列布局，缺少通栏服务商概览条、左栏 336px 三步准备指引与官方帮助中心入口、账户名称自定义字段、密码框内嵌「本机加密」胶囊、默认折叠的服务器配置核对条及空闲态蓝色信息提示卡。
- 方案：对照 `OmniMail-redesign.fig` → `09 · 邮箱接入指引` 亮/暗双色规范，重构邮箱接入弹窗体系，升级 `PreparationGuideCard`，统一 `ProviderGuideModal`、`OAuthFlowModal` 与 `ManualImapModal` 的 `min(980px, calc(100vw - 40px))` 双栏响应式容器、服务商概览条与 64px 底部操作栏，并补齐中英双语词典与单测门禁。

## 实现与验证

- **服务商预设目录与双语国际化**：扩展 `types/account.ts`（`domainHint`、`officialGuideUrl`、`emailPlaceholder`、`oauthSteps`），将 `data/providers.ts` 拆分为 `providersPrimary.ts` 与 `providersSecondary.ts` 并补齐全部 9 家内置服务商（Gmail、Outlook、QQ 邮箱、网易邮箱、Linux Do、Naver Mail、Yandex、iCloud、Yahoo）的域名副文、HTTPS 官方帮助中心链接与三步准备文案；同步更新 `services/accountApi.ts`、`i18n/providerCatalogEn*.ts` 及 `i18n/{zh,en}/providerConnect.ts`。
- **共享双栏弹窗骨架与控件增强**：新增 `ProviderConnectShell.tsx`、`providerConnectHelpers.ts`，提供统一的 `19px` 主标题 +「已有账户接入」状态胶囊 + 统一副标题 + `32×32` 描边关闭按钮、`ProviderSummaryCard`（`40×40` 白底圆角徽章框内居中 `<ProviderIcon size={25} bare />`、域名副文、右侧带圆点 TLS / OAuth 2.0 蓝色胶囊）与 64px 浅底操作栏（`← 返回来源` + 亮 `#141E2E` / 暗 `#F1F5F9` 主按钮 `✓ 测试并连接`）。升级 `PasswordInput.tsx` 支持右侧内嵌「本机加密」胶囊与眼睛切换按钮；扩展 `ModalShell.tsx` 与 `ExternalLinkConfirmModal.tsx` 支持在接入弹窗上方叠加外链安全确认而不卸载下层表单。
- **左栏指引卡与三类接入弹窗重构**：升级 `ProbeReportList.tsx` 为 `PreparationGuideCard`（`01 / 02 / 03` 等宽微底徽章、全宽 `38px`「查看官方接入指引」外链按钮与防代填灰字说明，保留 `ProviderStepsCard` 兼容导出）；拆分 `ProviderGuideForm.tsx` 重构 `ProviderGuideModal.tsx`（含 `onBlur` 主机自动识别、新增账户名称字段、按服务商精准切换「客户端授权码 / App 专用密码 / 客户端专用令牌」、默认收起且旋转 `180°` 展开的服务器配置条，以及空闲态柔和蓝色信息卡与实时 `HandshakeSteps` 无缝切换）；拆分 `OAuthStatusColumn.tsx` 重构 `OAuthFlowModal.tsx`，并同步升级 `ManualImapModal.tsx` 与 `ManualImapFields.tsx`。
- **亮暗双色样式与单文件行数规范**：新增 `styles/provider-connect-modal.css`、`styles/provider-connect-form.css`、`styles/provider-connect-extras.css` 并引入 `main.tsx`，`< 820px` 自动回退单列；全仓所有手写源码文件严格控制在 `<= 200` 行内。
- **验证结果**：新增单测 `desktop/frontend/tests/provider-connect-modal.test.mjs`；执行 `npm run typecheck`、`npm test`、`npm run build` 与全量 `task verify` 全部通过（`gofmt` / `prettier --check` / `eslint` / `tsc --noEmit` / `vite build` / 80 项前端单测全部通过 / `go vet` / `go test` / `go build`）。
- **未验证事项**：未启动桌面应用窗口人工点击预览，未推送远程仓库。

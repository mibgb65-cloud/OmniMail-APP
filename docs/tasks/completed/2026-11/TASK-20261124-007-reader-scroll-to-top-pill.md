# TASK-20261124-007 · 邮件正文阅读区回到顶部悬浮轻胶囊

- 状态：Completed
- 当前行为：左侧邮件列表已有 `240px` 触发的回到顶部轻胶囊与头部底阴影，但右侧邮件正文阅读区（`MailReaderPane.tsx`）长邮件滚动时缺少回顶胶囊与工具栏阴影，且胶囊样式变量仅局部声明在 `.mail-list-pane` 下。
- 方案：抽取公共 `ScrollToTopPill` 组件与共享 `--scroll-pill-*` / `--scroll-header-edge-shadow` 主题变量；在阅读区以 `div.reader-body` 包裹正文滚动视口与胶囊，使其恒定锚定在 `<QuickReplyBox>` 正上方 `14px`，并实现 `scrollTop > 0` 工具栏阴影、`scrollTop > 320` 胶囊浮现、防遮挡底留白、切邮件无闪烁归零及打印隐藏。
- 验证计划：运行 `pnpm test`、`tsc --noEmit`、`pnpm build` 与全量 `task verify`。

## 实现与验证

- 组件与样式统一：新增 `components/common/ScrollToTopPill.tsx`（含无障碍隐藏态属性与 `prefers-reduced-motion` 感知的 `scrollViewportToTop`），并在 `iconRegistry.ts` 注册 `arrowUp`；在 `mail-list-return-top.css` 将胶囊与头部阴影 Token 提升至 `:root` / `:root[data-theme="dark"]` 供 `MailListBody` 与 `MailReaderPane` 共享（列表底部偏移 `16px`，阅读区 `.reader-return-top` 底部偏移 `14px`）。
- 阅读区交互与防遮挡：将标题与来源标签拆分为 `ReaderSubjectSection.tsx`（保持所有源码文件 `<= 200` 行）；`MailReaderPane.tsx` 使用 `div.reader-body` 包裹 `<FadeScroll className="reader-scroll selectable">` 与 `<ScrollToTopPill>`，置于 `<ReaderToolbar>` / `<TranslationBanner>` 之下、`<QuickReplyBox>` 之上；`scrollTop > 0` 时为 `ReaderToolbar` 开启 `data-scrolled` 底阴影，`scrollTop > 320` 时显示 `48px` 底部渐变与 `56px` 内容底留白；通过 `profileId:mailId` 作用域派生与 `useLayoutEffect` 归零 `scrollTop`，切换邮件或处于零账号/未选邮件空态时绝不残留旧胶囊；`@media print` 自动隐藏胶囊与遮罩。
- 验证结果：补充 `tests/mail-list-arrivals.test.mjs` 单测；`tsc --noEmit`、`pnpm build`（0 错误、0 警告）及全量 `task verify`（含 37 项前端单测、ESLint、`go test ./...` 与开发构建）全部通过。
- 未验证事项：按协作规则未启动原生桌面窗口人工预览。
- 实现已提交：`10e54548e47b0574ccbed4ef1031e4c1ef2dc24f`，纳入 [Beta 9 本地安装包](TASK-20261124-010-windows-beta-9-local-release.md)。
- 关联：[冒烟测试](../../../development/TESTING.md)。

# TASK-20261124-008 · 重构邮件安全警示横幅与修复 DMARC 转发误报

- 状态：Completed
- 当前行为：`desktop/internal/security/phishing.go` 在 `dmarc == "pass"` 且 `dkim == "pass"` 的正常转发场景下仍会因 `spf == "fail"` / `"softfail"` 触发 `warning` 误报；前端 `ReaderSecurityBanners.tsx` 硬编码 `danger` 血红色、将 `SPF/DKIM/DMARC` 三枚胶囊全部写死为红色，并把操作按钮竖排堆叠在右侧，缺少收起信任入口。
- 方案：后端 `EvaluatePhishing` 对齐 DMARC 原则消除转发误报；前端抽离 `securityBannerPolicy.ts` 与 `mail-security-banner.css`，按 `level` 动态渲染警示红/琥珀黄，采用「上（标题 + 3 枚按真实结果分色的小胶囊）- 中（常规副色详情）- 下（左横排按钮组 + 右侧 `信任此发件人`）」三段式紧凑布局。
- 验证计划：运行 `go test ./...`、`tsc --noEmit`、`pnpm build` 与全量 `task verify`。

## 实现与验证

- 后端误报修复：`phishing.go` 仅在 `dmarc == "fail" || (spf == "fail" && dkim == "fail")` 时触发 `danger`，仅在 `dmarc != "pass"` 且存在 `spf == "fail" || spf == "softfail" || dkim == "fail"` 时触发 `warning`；`security_test.go` 新增 `TestEvaluatePhishingDMARCAlignment` 覆盖 `spf=fail, dkim=pass, dmarc=pass`（返回 `nil`）、`spf=fail, dkim=fail, dmarc=fail`（返回 `danger`）与 `spf=fail, dkim=unknown, dmarc=unknown`（返回 `warning`）。
- 前端三段式横幅与分色：新增 `securityBannerPolicy.ts` 与 `mail-security-banner.css`（保持所有源码文件 `<= 200` 行），`ReaderSecurityBanners.tsx` 动态区分 `danger`（亮色 `#FEF2F2`/`#FECACA`、暗色 `#3B1820`/`#7F1D1D`）与 `warning` 琥珀样式；顶部右侧 3 枚 22px 等宽胶囊按 `pass`（绿）、`fail`（红）、`softfail`（琥珀）、`unknown`/`none`/`neutral`（中性灰）独立着色；中部详情使用 `var(--text-secondary)`；底部左起横排「移入垃圾邮件」「拉黑发件人」「查看原始邮件头」，最右侧提供「信任此发件人」收起当前工作空间会话内该发件人的安全提醒并弹出轻提示。
- 验证结果：新增前端单测 `tests/security-banner.test.mjs`；`tsc --noEmit`、`pnpm build`（0 错误、0 警告）及全量 `task verify`（含 40 项前端单测、`go test ./...` 与开发构建）全部通过。
- 未验证事项：按协作规则未启动原生桌面窗口人工预览。
- 实现已提交：`10e54548e47b0574ccbed4ef1031e4c1ef2dc24f`，纳入 [Beta 9 本地安装包](TASK-20261124-010-windows-beta-9-local-release.md)。
- 关联：[冒烟测试](../../../development/TESTING.md)。

# TASK-20261127-007 接入 OmniMail 发布者数字签名与正式版用户协议/隐私政策

- **状态**：Completed
- **日期**：2026-11-27
- **实现提交**：随本次 `feat/windows-self-sign` 分支提交，经 `dev → test → prod` PR 晋级后更新 `v0.0.1` 正式版发布包

## 1. 原始需求
1. 为主程序与 Windows 安装包签入统一的自签名发布者身份 `OmniMail`（无需购买商业证书消除系统未知发布者拦截提示，确保文件数字签名与 PE 元数据发布者统一为 `OmniMail`）；
2. 将应用内《用户协议》与《隐私政策》从早期“界面设计预览草案 / 法务定稿版本”全面升级为完整的双语正式生效版本，移除草案黄条与占位提示。

## 2. 实际改动
- **Windows 全链路 `CN=OmniMail` 数字签名流水线**：
  - 生成 10 年期 `CN=OmniMail`（RSA 3072 + SHA256）代码签名证书，公开验证证书保存于 `desktop/build/windows/OmniMail-CodeSigning.cer`，加密私钥安全注入 GitHub Secrets（`WINDOWS_SIGN_PFX_BASE64` / `WINDOWS_SIGN_PFX_PASSWORD`），并在 `.gitignore` 屏蔽 `*.pfx` / `*.p12`；
  - 统一 `desktop/build/windows/info.json` 与 `desktop/build/windows/installer/omnimail.nsi` 发布者名称为 `OmniMail`；
  - 新增 `desktop/build/windows/sign-windows-binary.ps1`，在 `package-windows.ps1` 中对内层 `OmniMail.exe` 与外层 `OmniMail-windows-Setup-*.exe` 自动执行 Authenticode 签名与时间戳固化（先签名后生成 `SHA256SUMS.txt`），并在 `.github/workflows/release.yml` 增加发布前签名强校验。
- **双语正式版《用户协议》与《隐私政策》**：
  - 新增 `desktop/frontend/src/data/legalDocsZh.ts` 与 `desktop/frontend/src/i18n/legalDocsEn.ts`（各 6 条完整条款，如实对应 MIT 开源许可、本地优先零云端账号、DPAPI 加密、5 步 `PrivacyGuard` AI 与反追踪安全边界）；
  - 更新 `LegalDocModal.tsx`、`zh/onboarding.ts`、`en/onboarding.ts`、`zh/settingsAdvanced.ts`、`en/settingsAdvanced.ts`，彻底移除黄色草案提示条与“草案 / Draft”字样，并新增 `tests/legal-docs.test.mjs` 单测门禁。

## 3. 验证结果
- 本地全量 `task verify`（含 `131/131` 前端单测与全量 Go 测试）及 `sign-windows-binary.ps1` 数字签名实测通过；所有源码文件均保持 `<= 200` 行；
- 晋级合入 `prod` 后重推 `v0.0.1` 标签，由机器人重新构建上传带 `CN=OmniMail` 签名的 `OmniMail-windows-Setup-v0.0.1.exe` 与最新 `SHA256SUMS.txt`。

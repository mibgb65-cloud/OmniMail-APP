# TASK-20261127-005 三轨版本号、安装包命名与标签驱动发版治理（含 v0.0.1 正式版发布）

- **状态**：Completed
- **日期**：2026-11-27
- **实现提交**：随本次 `feat/release-tag-governance` 分支提交并经 `dev → test → prod` PR 晋级后推送 `v0.0.1` 标签

## 1. 原始需求
1. 规范三环境分支与版本构建逻辑：
   - `dev` → `vX.Y.Z-alpha.N`（仅本地开发测试打包使用，线上不打包但允许保留标签；历史本地测试 beta 包/标签不上传）；
   - `test` → `vX.Y.Z-beta.N`（仅在推送标签且提交属于 `test` 分支时触发线上 Beta 预发布打包，常规 MR 合入不自动打包）；
   - `prod` → `vX.Y.Z`（仅在推送标签且提交属于 `prod` 分支时触发线上正式生产版打包，常规 MR 合入不自动打包）。
2. 统一安装包文件名规范为：
   - `OmniMail-windows-Setup-vX.Y.Z.exe`
   - `OmniMail-windows-Setup-vX.Y.Z.beta.N.exe`
   - `OmniMail-windows-Setup-vX.Y.Z.alpha.N.exe`

## 2. 实际改动
- **三轨打包脚本与任务入口**：
  - 升级 `desktop/build/windows/package-windows.ps1`、`desktop/build/windows/installer/omnimail.nsi` 与 `Taskfile.yml`（新增 `package:windows:alpha`），完整支持 `stable` / `beta` / `alpha` 三轨版本注入（兼容 `-beta.`/`.beta.` 与 `-alpha.`/`.alpha.`），统一输出 `OmniMail-windows-Setup-vX.Y.Z[.beta.N|.alpha.N].exe` 与 `SHA256SUMS.txt`。
- **更新器三轨版本序与资产匹配**：
  - 升级 `desktop/internal/updater/version.go`、`desktop/internal/updater/feed.go`、`desktop/version.go` 与前端 `desktop/frontend/src/state/useUpdateActions.ts`，实现 `alpha < beta < stable` 版本序比较、线上更新源自动忽略 `alpha` 标签、优先精确匹配 `OmniMail-windows-Setup-*.exe` 安装包名（保留旧命名向下兼容），并补充 `version_test.go` 与 `updater_test.go` 单测。
- **纯标签触发与所属分支祖先强校验流水线**：
  - 重写 `.github/workflows/release.yml`：移除分支 `push` 自动发版，改为仅响应 `v*.*.*` 标签推送（`tags-ignore` 忽略 `*-alpha.*` / `*.alpha.*`）与受控手动触发；构建前通过 `git merge-base --is-ancestor` 强制核验正式版标签属于 `origin/prod`、Beta 标签属于 `origin/test`。
- **文档同步**：更新 `README.md`、`docs/development/BUILD.md`、`docs/development/GIT_WORKFLOW.md` 与 `docs/plans/CURRENT.md`。

## 3. 验证结果
- 本地全仓 `task verify` 零告警通过，修改源码文件均严格保持在 `<= 200` 行以内；
- 经 `feat/release-tag-governance → dev → test → prod` PR 晋级验证常规 MR 合入不再触发 `Release` 打包，随后在 `prod` 推送首个正式版标签 `v0.0.1` 触发线上 `OmniMail-windows-Setup-v0.0.1.exe` 打包发布。

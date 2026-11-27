# TASK-20261127-003 · 接入真实 GitHub 仓库、双通道自动发版流水线与三环境分支保护治理

- 状态：Completed
- 实现提交：随本次远端初始化基线一并提交
- 实际改动：
  1. **切换真实 GitHub 更新源**：将 `desktop/version.go`、`desktop/internal/updater/feed.go`、`desktop/build/windows/package-windows.ps1`、`desktop/frontend/src/services/updaterApi.ts`、`UpdateFlowModal.tsx` 与 `ShortcutsAndAboutTabs.tsx` 中的默认仓库地址统一改为 `mibgb65-cloud/OmniMail-APP`，并同步更新 Go/前端单测；
  2. **升级 CI 与双通道自动发版 Actions**：更新 `.github/workflows/ci.yml`（覆盖针对 `dev`、`test`、`prod` 的 PR 与推送门禁 `verify`），新增 `.github/workflows/release.yml`（合入 `test` 自动构建 NSIS 安装包并发布 Beta Pre-release，合入 `prod` 自动发布 Stable Release，同时支持 `workflow_dispatch` 手动指定通道与版本号触发）；
  3. **初始化 `dev` / `test` / `prod` 三环境分支与零绕过 Ruleset 保护**：关联远端 `https://github.com/mibgb65-cloud/OmniMail-APP.git`，推送初始化 `prod`、`test`、`dev` 三条分支，将 GitHub 默认分支设为 `prod`，并通过 Repository Ruleset 锁定三条分支（含仓库 Owner 在内禁止直接推送、禁止 `--force` 强推、禁止删除分支，必须经 Pull Request 且 `verify` CI 通过后合入），同步更新 `docs/development/GIT_WORKFLOW.md` 与 `docs/plans/CURRENT.md`。
- 验证结果：
  - 全仓 `task verify`（含 `130/130` 前端单测与全量 Go 测试）零告警通过，远端分支保护与禁直推实测生效。

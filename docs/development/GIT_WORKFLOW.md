# Git 与分支晋级工作流

远端仓库：`https://github.com/mibgb65-cloud/OmniMail-APP`（默认分支：`prod`）。

## 一、受保护环境分支与晋级路径

仓库常驻三条受 GitHub Ruleset 严格保护的环境分支（含管理员零绕过，**禁止直接 `git push`、禁止 `--force` 强推、禁止删除分支**，必须经 Pull Request 且 `CI / verify` 全绿后方可合入）：

1. **`dev`（开发集成分支）**：日常新需求与缺陷修复的首站汇合基线。
2. **`test`（测试预发布分支）**：提测验收分支；PR 合入后由 `.github/workflows/release.yml` 自动打包 Windows NSIS 安装程序并发布 **Beta Pre-release**（对应客户端「Beta 测试通道」自动更新）。
3. **`prod`（生产稳定分支 / 默认分支）**：对外正式版基线；PR 合入后自动打包并发布 **Stable Release**（对应客户端「Stable 稳定通道」自动更新）。

标准研发与发版路径：

`本地功能分支 (feat/* · fix/*)` → 推送分支至远端 → **PR 合入 `dev`** → **PR 合入 `test`（测试验收 & 自动发 Beta 包）** → **PR 合入 `prod`（正式发布 & 自动发 Stable 包）**

> **合并方式铁律**：
> - `feat/* → dev`：可使用 **Squash and merge** 或 **Create a merge commit**；
> - `dev → test` 与 `test → prod`：**必须使用 Create a merge commit（严禁使用 Squash 或 Rebase）**，确保三条常驻分支保持共同祖先提交，避免后续跨环境晋级产生假冲突。

## 二、本地开发与提交细则

1. 开发前先在 `docs/tasks/active/` 创建任务记录，基于最新 `origin/dev` 切出功能分支（如 `git switch -c feat/xxx origin/dev`）。
2. 提交前检查差异与 `task verify` 结果，确保不包含生成的绑定、构建产物、账号凭据、邮件内容或日志。
3. 用户要求提交时，使用清晰的简体中文提交说明（如 `feat(ui): …`、`fix(security): …`）；多项不相关改动拆开提交。
4. 完成后将验证结果与提交哈希回填至任务记录并归档到 `docs/tasks/completed/YYYY-MM/`；未要求提交时写「未提交」，不伪造记录。

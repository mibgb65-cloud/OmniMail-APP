# Git、分支晋级与标签发版工作流

远端仓库：`https://github.com/mibgb65-cloud/OmniMail-APP`（默认分支：`prod`）。

## 一、受保护环境分支与三轨版本规范

仓库常驻三条受 GitHub Ruleset 严格保护的环境分支（含管理员零绕过，**禁止直接 `git push`、禁止 `--force` 强推、禁止删除分支**，必须经 Pull Request 且 `CI / verify` 全绿后方可合入）：

| 环境分支 | 版本标签格式 | 安装包输出文件名 | 触发与打包规则 |
| :--- | :--- | :--- | :--- |
| **`dev`**（开发分支） | `v1.2.0-alpha.1` | `OmniMail-windows-Setup-v1.2.0.alpha.1.exe` | **仅用于本地开发测试打包**；线上 Actions 忽略 `alpha` 标签不打包（本地历史测试标签不上传远端） |
| **`test`**（测试分支） | `v1.2.0-beta.1` | `OmniMail-windows-Setup-v1.2.0.beta.1.exe` | 常规 PR 合入仅跑 `verify`、**不自动打包**；仅当对 `test` 分支提交推送 `vX.Y.Z-beta.N` 标签时触发 **Beta Pre-release** |
| **`prod`**（生产分支） | `v1.2.0` | `OmniMail-windows-Setup-v1.2.0.exe` | 常规 PR 合入仅跑 `verify`、**不自动打包**；仅当对 `prod` 分支提交推送 `vX.Y.Z` 标签时触发 **Stable Release** |

标准研发与发版晋级路径：

`本地功能分支 (feat/* · fix/*)` → 推送分支至远端 → **PR 合入 `dev`** → **PR 合入 `test`（按需推 `-beta.N` 标签发测试包）** → **PR 合入 `prod`（按需推 `vX.Y.Z` 标签发正式包）**

> **合并方式铁律**：
> - `feat/* → dev`：可使用 **Squash and merge** 或 **Create a merge commit**；
> - `dev → test` 与 `test → prod`：**必须使用 Create a merge commit（严禁使用 Squash 或 Rebase）**，确保三条常驻分支保持共同祖先提交，避免后续跨环境晋级产生假冲突。

## 二、标准推送标签触发发版命令

```powershell
# 1. 在 test 分支发布 Beta 测试版（提交须已合入 origin/test）
git fetch origin test
git tag -a v1.2.0-beta.1 origin/test -m "Release v1.2.0-beta.1"
git push origin v1.2.0-beta.1

# 2. 在 prod 分支发布正式生产版（提交须已合入 origin/prod）
git fetch origin prod
git tag -a v1.2.0 origin/prod -m "Release v1.2.0"
git push origin v1.2.0
```

## 三、本地开发与提交细则

1. 开发前先在 `docs/tasks/active/` 创建任务记录，基于最新 `origin/dev` 切出功能分支（如 `git switch -c feat/xxx origin/dev`）。
2. 提交前检查差异与 `task verify` 结果，确保不包含生成的绑定、构建产物、账号凭据、邮件内容或日志。
3. 用户要求提交时，使用清晰的简体中文提交说明（如 `feat(ui): …`、`fix(security): …`）；多项不相关改动拆开提交。
4. 完成后将验证结果与提交哈希回填至任务记录并归档到 `docs/tasks/completed/YYYY-MM/`；未要求提交时写「未提交」，不伪造记录。

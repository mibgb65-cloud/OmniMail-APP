# Git、分支晋级与标签发版工作流

远端仓库：`https://github.com/mibgb65-cloud/OmniMail-APP`（默认分支：`prod`）。

## 一、受保护环境分支与三轨版本规范

仓库常驻三条受 GitHub Ruleset 严格保护的环境分支（含管理员零绕过，**禁止直接 `git push`、禁止 `--force` 强推、禁止删除分支**，必须经 Pull Request 且 `CI / verify` 全绿后方可合入）：

| 环境分支 | 版本标签格式 | 安装包输出文件名 | 触发与打包规则 |
| :--- | :--- | :--- | :--- |
| **`dev`**（开发分支） | `v1.2.0-alpha.1` | `OmniMail-windows-Setup-v1.2.0.alpha.1.exe` | **仅用于本地开发测试打包**；线上 Actions 忽略 `alpha` 标签不打包（本地历史测试标签不上传远端） |
| **`test`**（测试分支） | `v1.2.0-beta.1` | `OmniMail-windows-Setup-v1.2.0.beta.1.exe` | 常规 PR 合入不自动打包；须先入库 `docs/releases/vX.Y.Z-beta.N.md` 后推标签，由机器人自动创建发布 **Beta Pre-release** |
| **`prod`**（生产分支） | `v1.2.0` | `OmniMail-windows-Setup-v1.2.0.exe` | 常规 PR 合入不自动打包；须先入库 `docs/releases/vX.Y.Z.md` 后推标签，由机器人自动创建发布 **Stable Release** |

标准研发与发版晋级路径：

`本地功能分支 (feat/* · fix/* · docs/*)` → 推送分支至远端 → **PR 合入 `dev`** → **PR 合入 `test`（入库更新文档 + 推 `-beta.N` 标签触发机器人发版）** → **PR 合入 `prod`（入库更新文档 + 推 `vX.Y.Z` 标签触发机器人发版）**

> **合并方式与纯文档快通道**：
> - `feat/* → dev`：可使用 **Squash and merge** 或 **Create a merge commit**；
> - `dev → test` 与 `test → prod`：**必须使用 Create a merge commit（严禁使用 Squash 或 Rebase）**，确保三条常驻分支保持共同祖先提交；
> - **纯文档 MR 快通道**：当 PR 仅修改 Markdown 文档类文件（如 `README.md`、`AGENTS.md`、`docs/**/*.md`）时，`CI / verify` 自动跳过 Go/Node/Wails 编译与单测，仅执行本地相对链接存在性核验后秒级通过。

## 二、标准发版操作闭环（先入库更新文档 → 再推标签由机器人发布）

每次发布线上版本必须严格遵循以下三步（详见 [版本更新文档规范](../releases/README.md)）：

1. **新增版本更新文档并合入仓库**：
   - 在 `docs/releases/<tag>.md`（如 `docs/releases/v1.2.0-beta.1.md` 或 `docs/releases/v1.2.0.md`）编写本次更新说明，并在 `docs/releases/README.md` 登记索引；
   - 通过分支提 MR 晋级合入目标环境分支（纯文档 MR 自动走快通道秒级放行）。
2. **在目标分支推送版本标签**：

```powershell
# 在 test 分支发布 Beta 测试版（提交须包含 docs/releases/v1.2.0-beta.1.md 且已合入 origin/test）
git fetch origin test
git tag -a v1.2.0-beta.1 origin/test -m "Release v1.2.0-beta.1"
git push origin v1.2.0-beta.1

# 在 prod 分支发布正式生产版（提交须包含 docs/releases/v1.2.0.md 且已合入 origin/prod）
git fetch origin prod
git tag -a v1.2.0 origin/prod -m "Release v1.2.0"
git push origin v1.2.0
```

3. **机器人全自动创建并发布 GitHub Release**：
   - `.github/workflows/release.yml` 强制核验标签所属受保护分支及 `docs/releases/<tag>.md` 存在性，执行全量 `task verify` 并打包生成 `OmniMail-windows-Setup-*.exe` 与 `SHA256SUMS.txt`；
   - 由 `github-actions[bot]` 读取 `docs/releases/<tag>.md` 作为发布说明全自动创建并发布 GitHub Release（无需人工在网页端手动创建）。

## 三、本地开发与提交细则

1. 开发前先在 `docs/tasks/active/` 创建任务记录，基于最新 `origin/dev` 切出功能分支（如 `git switch -c feat/xxx origin/dev`）。
2. 提交前检查差异与 `task verify` 结果，确保不包含生成的绑定、构建产物、账号凭据、邮件内容或日志。
3. 用户要求提交时，使用清晰的简体中文提交说明（如 `feat(ui): …`、`fix(security): …`）；多项不相关改动拆开提交。
4. 完成后将验证结果与提交哈希回填至任务记录并归档到 `docs/tasks/completed/YYYY-MM/`；未要求提交时写「未提交」，不伪造记录。

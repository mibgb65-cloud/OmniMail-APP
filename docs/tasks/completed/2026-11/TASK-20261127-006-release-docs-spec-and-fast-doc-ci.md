# TASK-20261127-006 版本更新文档入库规范、机器人自动发布说明与纯文档 MR 快通道

- **状态**：Completed
- **日期**：2026-11-27
- **实现提交**：随本次 `feat/release-docs-and-fast-ci` 分支提交并经 `dev → test → prod` PR 晋级合入

## 1. 原始需求
1. 每次发版时须在 `docs/` 下新增对应版本的更新文档并提交进仓库，将该要求正式写入项目协作与发版规范；
2. 发版时由 GitHub Actions 机器人自动读取更新文档创建并发布 GitHub Release；
3. 纯文档更新类的 MR 无需执行耗时的 Go/Node/Wails 全量编译与单测，提供快速放行机制。

## 2. 实际改动
- **版本更新文档体系（`docs/releases/`）**：
  - 新建 `docs/releases/README.md`（历史版本索引、客户端摘要提取约定与强制入库门禁说明）与 `docs/releases/v0.0.1.md`（首个正式生产版发布说明）。
- **机器人自动发布与更新文档强校验（`.github/workflows/release.yml`）**：
  - 标签校验阶段强制检查 `docs/releases/<tag>.md` 存在且非空，缺失直接拦截发版；
  - 由 `github-actions[bot]` 使用 `--notes-file "docs/releases/<tag>.md"` 自动创建/更新并发布 GitHub Release（同步作为客户端内置更新浮层摘要源）。
- **纯文档 MR 快通道（`.github/workflows/ci.yml`）**：
  - 移除受保护分支合并后的冗余 `push` 触发；
  - 在 `verify` 首步检测 PR 变更文件范围：若仅修改文档类文件（`README.md`、`AGENTS.md`、`LICENSE`、`docs/**/*.md` 等），仅执行毫秒级本地相对链接核验并跳过 Go/Node/Wails 安装与 `task verify` 编译单测。
- **工程规则同步**：写入 `AGENTS.md`、`docs/README.md`、`docs/development/GIT_WORKFLOW.md` 与 `README.md`。

## 3. 验证结果
- 本地脚本核验全部修改 Markdown 文件相对链接有效；
- 经 `feat/release-docs-and-fast-ci → dev → test → prod` PR 晋级验证，并将线上已发布的 `v0.0.1` Release 说明同步更新为 `docs/releases/v0.0.1.md`。

# 版本更新文档（Release Notes）

本目录维护 OmniMail 每个正式生产版（`prod` → `vX.Y.Z`）与测试预发布版（`test` → `vX.Y.Z-beta.N`）的官方更新说明，也是 **GitHub Release 发布页正文**与**桌面客户端内置「检查更新」变更亮点浮层**的唯一权威数据源。

## 已发布版本索引

| 版本标签 | 发布日期 | 通道 | 对应分支 | 安装包文件名 | 更新说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`v0.0.1`](v0.0.1.md) | 2026-11-27 | `Stable` | `prod` | `OmniMail-windows-Setup-v0.0.1.exe` | [查看更新说明](v0.0.1.md) |

---

## 发版文档编写与机器人发布规范

1. **先入库文档，再推送标签（CI 强门禁）**：
   - 计划在 `test` 发布 `vX.Y.Z-beta.N` 或在 `prod` 发布 `vX.Y.Z` 前，必须先在本目录新建同名文件 `docs/releases/<tag>.md`，并在上方索引表追加一行；
   - 通过纯文档分支提 MR 合入目标环境分支（纯文档 MR 自动走秒级链接核验快通道，无需编译等待）；
   - `.github/workflows/release.yml` 在收到标签推送后会**强制检查 `docs/releases/<tag>.md` 是否存在且非空**，缺失时直接拦截拒绝打包。
2. **机器人全自动创建与发布 GitHub Release**：
   - 标签推送后，由 `github-actions[bot]` 全自动完成 `task verify`、NSIS 安装包编译、`SHA256SUMS.txt` 生成，并读取 `docs/releases/<tag>.md` 作为 `--notes-file` 自动创建并发布 GitHub Release（测试版自动标为 `Pre-release`，正式版自动标为 `Latest`），全程无需人工在网页端手动创建 Release。
3. **本地开发版（`alpha`）免写文档**：
   - `dev` 分支本地自测使用的 `vX.Y.Z-alpha.N` 不触发线上打包，无需在本目录创建发布文档。
4. **排版与客户端高亮提取约定**：
   - 文档顶部建议放置 3～5 条以 `- ` 开头的核心更新要点——桌面客户端内置更新器（`extractReleaseHighlights`）会自动提取前 5 条列表项展示在顶栏更新气泡与升级弹窗中。

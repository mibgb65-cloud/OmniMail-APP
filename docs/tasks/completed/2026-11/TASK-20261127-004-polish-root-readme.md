# TASK-20261127-004 重写仓库根 README.md（面向开源发布与社区分享）

- **状态**：Completed
- **日期**：2026-11-27
- **实现提交**：随本次 `docs/readme-polish` 分支一并提交并向 `dev` 发起 PR

## 1. 原始需求
用户计划将 OmniMail 分享至 Linux.do 社区与 GitHub 开源受众，要求先编写一份高颜值、信息结构清晰、准确实用且贴合极客与日常用户痛点的仓库根目录 `README.md` 供审阅。

## 2. 实际改动
- **[README.md](../../../README.md)**：将初始化阶段占位说明全面重写为正式开源版主页文档，包含：
  - **自适应品牌头图与状态徽章栏**：通过 `<picture>` 标签自动随 GitHub 亮/暗模式切换 `logo.svg` 与 `logo-dark.svg`，集成 CI、Release、平台、技术栈（Wails v3.1 · Go 1.26 · React 19）、`~7.4 MB` 零 CGO 安装包体积与 MIT 协议徽章及锚点导航；
  - **痛点定位与 Linux.do 专属提示**：直击臃肿客户端、云同步隐私越界与本土/极客协议水土不服三大痛点，突出原生内置 Linux.do 社区邮箱、AI Agent 邮箱与免 Key 保真翻译；
  - **带高清官方图标的 18+ 邮箱支持矩阵**：分类呈现社区/AI Agent 工作台（Linux.do、Meta Muse `@muse.ai`、腾讯 WorkBuddy）、8 家主流个人邮局（Gmail / Outlook / QQ / 网易 `RFC2971 ID` / iCloud / Yahoo / Yandex / Naver）与 6 家企业邮局（腾讯 / 阿里 / 网易灵犀 / 飞书 / 263 / Zoho）及通用 DNS MX 自动识别；
  - **四大核心特性深度拆解与数据隐私边界表**：涵盖多本地空间物理隔离 + Argon2id PIN + DPAPI 加密、HTML/CSS 净化与 DMARC 反钓鱼、免密保真翻译 + 5 步 `PrivacyGuard` BYOK AI、双连接 IMAP + FTS5 + Zstd CAS + `outbox_jobs` 真撤回/定时发信、30 天规则干跑与 `.ics` 日程协同；
  - **架构图、工程指南与特别致谢**：提供跨渲染器兼容的 Mermaid 系统架构图、目录树、Windows 安装包获取与静默部署参数、源码构建命令、受保护分支（`feat/* → dev → test → prod`）贡献指南、文档导航表，以及带官方社区图标的 **LINUX DO 社区（`https://linux.do`）特别致谢**专节；
  - **[.github/workflows/ci.yml](../../../.github/workflows/ci.yml)**：补充 `workflow_dispatch:` 触发器并唤醒新仓库首次 PR 状态检查注册。

## 3. 验证结果
- **链接、锚点、图标与命令全量核验**：通过 PowerShell 脚本自动解析 `README.md`，验证 `9/9` 个页内锚点、`14/14` 个本地相对文档链接、`21/21` 个品牌/邮局 SVG 与 PNG 图标路径全部真实存在，且所列 `6/6` 个 `task` 命令与 `Taskfile.yml` 定义完全一致。
- **未执行事项**：本次为纯文档改动，遵照协作规则未启动应用、未打包安装包、未创建 Git 提交。

## 4. 关联文档
- [README.md](../../../README.md)
- [docs/product/PRD.md](../../product/PRD.md)
- [docs/architecture/OVERVIEW.md](../../architecture/OVERVIEW.md)
- [docs/development/BUILD.md](../../development/BUILD.md)
- [docs/development/GIT_WORKFLOW.md](../../development/GIT_WORKFLOW.md)

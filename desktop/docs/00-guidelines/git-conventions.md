# Git 提交规范

> 状态：已生效 | 最后更新：2026-10-31

## 0. 授权与工作树保护

- 先遵守[根目录 AGENTS.md](../../../AGENTS.md)和[任务管理](../07-tasks/README.md)，所有修改先有任务记录。
- 未经明确授权，不自动暂存、提交、推送、切换分支、重置、清理或改写历史。
- 既有修改和未跟踪文件不得覆盖或混入本任务提交；同文件混合修改需按差异块审阅，不能直接 `git add .`。
- 没有提交授权时记录实际实现、验证和“未提交”，保持待评审；只有用户明确允许免提交结案时才可按规范归档。
- 登记的是已产生的真实实现提交号，不预填 SHA，也不为登记自身哈希反复 amend。
- 2026-10-31 已按用户授权将开发基线通过 PR 交付 `dev`；远端默认分支仍为 `main`。
  本次实际核验 `dev` 受保护、必须 PR；普通直推即使管理员也被拒绝，不应使用强推或 admin 绕过。
  保护/审批配置可能变化，后续仍需核验，不能把本文或 Git 本地跟踪记录当作实时远端证明。
  当前工作分支以 `git status --branch` / `git branch -vv` 为准，不再默认认为一定在 main。

---

## 1. 分支模型（Trunk-based 轻量版）

```
main                主分支（协作目标：受保护、可构建）
└── feat/<scope>-<slug>      功能
└── fix/<scope>-<slug>       缺陷修复
└── refactor/<scope>-<slug>  重构（不改行为）
└── docs/<slug>              仅文档
└── chore/<slug>             构建、依赖、配置
└── release/<x.y.z>         发布准备（冻结期）
```

规则：

- 主分支以实际仓库配置为准，按团队约定通过 PR 合并；不得为了匹配文档擅自重命名或更改保护配置。
- 分支存活周期目标 ≤ 5 个工作日；超过需拆分或说明。
- 合并策略：**Squash merge**（保持线性历史），PR 标题即为最终提交信息。
- 合并后删除远端分支。

## 2. Commit Message（Conventional Commits）

```
<type>(<scope>): <subject>

<body 可选，说明为什么>

<footer 可选：BREAKING CHANGE / Refs #123>
```

### type 取值

| type | 用途 |
| --- | --- |
| `feat` | 新功能（对应 MINOR 版本） |
| `fix` | 缺陷修复（对应 PATCH 版本） |
| `perf` | 性能优化 |
| `refactor` | 不改行为的重构 |
| `docs` | 文档 |
| `test` | 测试 |
| `build` | 构建脚本、依赖 |
| `ci` | CI 配置 |
| `chore` | 杂项 |

### scope 取值（desktop 域）

`app` `bridge` `service` `repository` `domain` `config` `platform` `logger` `ui` `docs` `release`

### 示例

```
feat(mail): 支持按附件名搜索邮件

IMAP SEARCH 不支持附件名，改为本地索引表 attach_name 前缀匹配，
超过 3 字时降级为 LIKE。

Refs #142
```

```
fix(bridge): 修复账号同步取消后 goroutine 泄漏

sync.WaitGroup 在 ctx 取消分支未 Done，改用 errgroup。

BREAKING CHANGE: SyncAccount 现在必须传 context，前端绑定签名已更新。
Refs #188
```

### 硬性要求

- subject 默认中文；协议或外部协作要求可用英文，**不超过 50 字符**，不以句号结尾，用祈使句。
- 一个 commit 只做一件事；混合行为变更与格式变更会打回。
- 关联 issue 用 `Refs #N`，关闭用 `Closes #N`。

## 3. PR 流程

1. 按[代码规范 §4](coding-standards.md#4-统一质量门禁)验证，并在任务记录中写明实际结果和覆盖范围。
2. PR 标题遵循上述 Commit 格式；描述填模板：

```markdown
## 变更内容
- ...

## 为什么
- ...

## 验证方式
- [ ] 本地跑通 <场景>
- [ ] 相关测试已补充/更新

## 影响面
- 数据库迁移：无 / 有（文件与回滚方案）
- 破坏性变更：无 / 有（说明）
- 文档更新：<文档链接>
```

3. 至少 1 名 reviewer approve；涉及 `domain` / `database` / 发布脚本需 2 名。
4. 有实际 CI 时确认其结果再合并；尚未接入时如实标明，由维护者审阅本地验证证据，不宣称 CI 全绿。合并与推送均按授权执行。

## 4. 版本号（SemVer）

`MAJOR.MINOR.PATCH[-pre]`，桌面端与前后端同步：

- `MAJOR`：数据格式不兼容、用户需迁移配置。
- `MINOR`：新功能、可回退的 UI 变化。
- `PATCH`：修复、性能、文案。

标签：`v1.4.0`。发布流程见 [06-release/release-checklist.md](../06-release/release-checklist.md)。

## 5. 不该提交的东西

- 任何凭据：`*.pem`、`*.key`、`token.json`、`.env`（只有 `.env.example` 入库）。
- 用户数据、真实邮件、日志导出。
- 构建产物：`desktop/build/bin/**`、`frontend/dist/**`、`frontend/node_modules`。
- 编辑器个人配置（放 `.git/info/exclude`）。

`.gitignore` 关键条目：

```gitignore
desktop/build/bin/
desktop/frontend/dist/
desktop/frontend/node_modules/
*.db
*.db-journal
logs/
.env
```

## 6. 回滚

- 缺陷已进入主分支：按授权优先使用 `git revert <sha>` 新提交回滚，**不要** force push。
- 已发布的版本：从标签重建 PATCH 版本，并在 [changelog](../08-history/changelog.md) 标注 `Reverted`。

# Git 提交规范

> 状态：已生效 | 最后更新：2026-10-15

---

## 1. 分支模型（Trunk-based 轻量版）

```
master              受保护，永远可构建、可发布
└── feat/<scope>-<slug>      功能
└── fix/<scope>-<slug>       缺陷修复
└── refactor/<scope>-<slug>  重构（不改行为）
└── docs/<slug>              仅文档
└── chore/<slug>             构建、依赖、配置
└── release/<x.y.z>         发布准备（冻结期）
```

规则：

- `master` 只接受 PR 合并，禁止直接 push。
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

- subject 中文或英文均可，**不超过 50 字符**，不以句号结尾，用祈使句。
- 一个 commit 只做一件事；混合行为变更与格式变更会打回。
- 关联 issue 用 `Refs #N`，关闭用 `Closes #N`。

## 3. PR 流程

1. 自测通过（[代码规范 §4](coding-standards.md) 的四条命令）。
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
4. CI 全绿后 Squash merge。

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

- 缺陷已进 `master`：优先 `git revert <sha>` 新提交回滚，**不要** force push。
- 已发布的版本：从标签重建 PATCH 版本，并在 [changelog](../08-history/changelog.md) 标注 `Reverted`。

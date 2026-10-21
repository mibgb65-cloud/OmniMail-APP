# OmniMail Desktop 文档中心

> 本目录是 **OmniMail 桌面端（Wails + Go + React）** 的唯一事实来源（Single Source of Truth）。
> Android / iOS 端文档位于各自目录下的 `docs/`，跨端共性内容以本仓库根 `docs/` 为准。

---

## 目录结构

| 目录 | 内容 | 谁是读者 |
| --- | --- | --- |
| [00-guidelines](00-guidelines/README.md) | 代码规范、Git 约定、文档规范、AI 协作规则 | 所有人（**新人必读**） |
| [01-product](01-product) | 产品定位、功能需求、路线图、功能详细设计 | 产品、设计、开发 |
| [02-architecture](02-architecture) | 总体架构、后端/前端/桌面端/数据库架构、ADR | 开发、架构 |
| [03-design](03-design) | 设计系统、组件规范、页面规格、设计资源 | 设计、前端 |
| [04-development](04-development) | 环境搭建、工程结构、API 契约、故障排查 | 开发、测试 |
| [05-testing](05-testing) | 测试策略、测试用例、缺陷记录 | 开发、测试 |
| [06-release](06-release) | 构建与发布、Windows/macOS 打包、发布检查单 | 开发、发布负责人 |
| [07-tasks](07-tasks/README.md) | 任务看板、Backlog、进行中、归档 | 所有人 |
| [08-history](08-history) | 变更日志、里程碑、复盘 | 所有人 |

---

## 三步上手

1. **了解项目**：[产品介绍](01-product/overview.md) → [总体架构](02-architecture/overview.md)
2. **跑起代码**：[环境准备](04-development/getting-started.md) → [工程结构](04-development/project-structure.md)
3. **开始干活**：[任务看板](07-tasks/README.md) → [进行中任务](07-tasks/active) → [AI 协作规范](00-guidelines/ai-agent-rules.md)

---

## 文档编号与命名

```
NN-领域/                 NN = 流水号，保证侧边栏顺序稳定
  README.md              目录总览（除已约定的 doc 文件外，每个目录建议有一个）
  kebab-case.md          文件名一律小写中划线，禁止中文、空格、大写
  features/FEAT-0001-xxx.md
  adr/ADR-0001-xxx.md
  test-cases/TC-xxx.md
  bug-reports/BUG-20261015-01.md
```

前缀约定：`FEAT-` 功能、`ADR-` 架构决策、`TC-` 测试用例、`BUG-` 缺陷、`TASK-` 任务。

---

## 常见入口速查

- 我要改一个后端接口 → [API 契约](04-development/api) + [后端架构](02-architecture/backend)
- 我要新增一个页面 → [页面规格](03-design/pages) + [组件库](03-design/components) + [前端架构](02-architecture/frontend)
- 我要打包发版 → [构建与发布](06-release/build.md) + [发布检查单](06-release/release-checklist.md)
- 代码跑不起来 → [故障排查](04-development/troubleshooting)
- 想记录一次架构取舍 → [ADR 模板](02-architecture/adr/README.md)

---

## 维护约定

- 代码变更必须同步文档，**文档随同一个 PR 提交**，不允许"下次补"。
- 每个文档首行写 `> 状态：草稿 | 评审中 | 已生效 | 已废弃` 与 `> 最后更新：YYYY-MM-DD`。
- 超出 3 个月未更新的架构文档，需在 PR 中确认是否仍然有效。

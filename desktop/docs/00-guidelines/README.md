# 项目规范（00-guidelines）

> 状态：已生效 | 最后更新：2026-10-15

本目录定义 OmniMail Desktop 的**强制**协作规则。规范与个人习惯冲突时，以本目录为准；
要修改规范，走 PR + 至少一名维护者 approve。

## 文档清单

| 文档 | 管什么 | 违反后果 |
| --- | --- | --- |
| [coding-standards.md](coding-standards.md) | Go / TypeScript / CSS 写法、命名、错误处理 | CI lint 失败 |
| [git-conventions.md](git-conventions.md) | 分支模型、Commit 格式、PR 流程、版本号 | PR 被拒 |
| [documentation.md](documentation.md) | 文档位置、模板、状态标记、链接规则 | review 不通过 |
| [ai-agent-rules.md](ai-agent-rules.md) | AI 助手（含 Claude / Copilot / Codex）的工作边界 | 回滚 + 记录 |

## 三条底线

1. **不猜**：不确定的字段、接口、行为，先在文档里标 `TODO(owner)`，不要用"看起来合理"的实现填坑。
2. **不静默**：任何跳过、降级、临时绕过，必须写进 PR 描述与 [changelog](../08-history/changelog.md)。
3. **不重复**：同一事实只在一个文件里定义，其它地方引用链接。重复即失同步。

## 规范评审节奏

- 每季度（1/4/7/10 月）复核一次，产出记录放 [08-history/retrospectives](../08-history/retrospectives)。

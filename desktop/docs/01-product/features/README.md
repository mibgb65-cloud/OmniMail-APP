# 功能详细设计索引

> 状态：已生效 | 最后更新：2026-10-15

每个功能一份文档，命名 `FEAT-<4位编号>-<slug>.md`。文档只写**本功能特有**的设计，
通用规范引用 [00-guidelines](../../00-guidelines)，架构引用 [02-architecture](../../02-architecture)。

## 清单

| 编号 | 功能 | 状态 | 对应需求 | 负责人 |
| --- | --- | --- | --- | --- |
| [FEAT-0001](FEAT-0001-account-onboarding.md) | 账号接入向导 | 开发中 | FR-01-1/2/3 | @backend-lead |
| [FEAT-0002](FEAT-0002-unified-inbox.md) | 统一收件箱 | 草稿 | FR-01-4, FR-02-1 | @frontend-lead |
| [FEAT-0003](FEAT-0003-compose-send.md) | 撰写与发送 | 草稿 | FR-02-4~8 | @backend-lead |
| [FEAT-0004](FEAT-0004-sync-engine.md) | 同步引擎 | 草稿 | FR-03-* | @backend-lead |
| [FEAT-0005](FEAT-0005-local-search.md) | 本地搜索 | 草稿 | FR-04-* | @backend-lead |
| [FEAT-0006](FEAT-0006-notification-tray.md) | 通知与托盘 | 草稿 | FR-05-1/2/3 | @frontend-lead |
| [FEAT-0007](FEAT-0007-safe-html-render.md) | 邮件 HTML 安全渲染 | 草稿 | FR-02-9 | @security |

## 文档模板

```markdown
# FEAT-xxxx 功能名

> 状态：草稿 | 负责人：@xxx | 最后更新：YYYY-MM-DD
> 需求：[FR-xx-xx](../requirements.md) | 相关 ADR：[ADR-xxxx](../../02-architecture/adr/README.md)

## 1. 背景与目标
## 2. 用户故事
## 3. 交互流程（含异常分支）
## 4. 数据结构与接口影响
## 5. 后端设计要点
## 6. 前端设计要点
## 7. 验收标准（可测试）
## 8. 非目标
## 9. 度量与观测
## 10. 风险与开放问题
```

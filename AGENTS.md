# OmniMail 协作规则

- 沿用 Wails v3 + Go + React + TypeScript；更改核心选型需说明取舍并记录 ADR。
- 非平凡改动先看 [产品范围](docs/product/PRD.md)、[架构](docs/architecture/OVERVIEW.md)和[当前状态](docs/plans/CURRENT.md)；构建、测试与提交细则从[文档索引](docs/README.md)进入。
- 开发改动开始前在 `docs/tasks/active/` 建立[任务记录](docs/tasks/README.md)，写清范围、方案和验证；完成后按月归档。
- 保持变更聚焦，新增外部输入必须在可信边界校验；不提交或记录账号令牌、邮件内容等敏感数据。用户可见文案和非显而易见的实现注释默认用简体中文。
- 代码改动使用 `task verify` 验证；纯文档修改核对链接和命令。工程规则变化需在同一次改动中更新对应文档。
- 普通构建使用 `task build`，只生成开发程序。未明确要求时，不启动应用、不做发布包，也不创建 Git 提交。

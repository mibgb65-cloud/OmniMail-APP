# 任务记录

在开发改动开始前，于 `active/` 创建 `TASK-YYYYMMDD-NNN-short-name.md`；当天从 `001` 递增。记录原始需求、范围、当前行为、实现计划及预期验证。

```text
Planned → In Progress → 实现与验证 → Completed → completed/YYYY-MM/
```

- 依赖外部输入而暂停时标记 `Blocked`，写清障碍和恢复条件；取消的任务标记 `Cancelled` 并归档。
- 完成前补充实际改动、验证结果、没有验证的事项和关联文档。同步更新真正受影响的文档，不把它们的内容复制进记录。
- 用户要求提交时记录实现提交号；没提交则明确标注。归档的是任务历史，不代表代码已提交或发布。
- `active/` 无任务时可不存在，开始新任务时创建；`plans/CURRENT.md` 只跟踪项目总体状态。

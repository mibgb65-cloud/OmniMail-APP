# 组件规范

> 状态：草稿 | 负责人：@design-lead | 最后更新：2026-10-15
> 相关：[设计系统](../design-system.md) · [页面规格](../pages/README.md)

---

## 1. 组件清单与状态

所有组件必须实现：`default` / `hover` / `active` / `focus-visible` / `disabled`；
数据类组件额外实现 `loading` / `empty` / `error`。

| 组件 | 层级 | 状态覆盖 | 说明 |
| --- | --- | --- | --- |
| [Button](button.md) | ui | 5 | primary / secondary / ghost / danger |
| [Input](input.md) | ui | 6 | 文本、搜索、密码 |
| Dialog | ui | 4 | 模态、抽屉 |
| Toast | ui | 4 | 成功/错误/信息，带动作 |
| Tooltip | ui | 2 | 延迟 400ms |
| Tabs | ui | 4 | 面板切换 |
| Menu | ui | 4 | 右键与下拉 |
| Checkbox / Radio / Switch | ui | 4 | — |
| [VirtualList](virtual-list.md) | composite | 4 | 固定行高虚拟滚动 |
| `AccountBadge` | composite | 3 | 账号色标 + 名称 |
| [MailRow](mail-row.md) | feature | 6 | 列表行 |
| EmptyState | ui | 1 | 图标 + 标题 + 描述 + 动作 |
| Skeleton | ui | 1 | 列表/正文骨架 |

## 2. 组件文档格式

每个组件一份 `kebab-case.md`，包含：

```markdown
# 组件名

## 用途
## Props
| prop | 类型 | 默认 | 说明 |
## 状态与视觉
## 键盘与可访问性
## 使用示例
## 反例
```

## 3. 按钮规范

| 变体 | 用途 | 视觉 |
| --- | --- | --- |
| primary | 每屏最多 1 个主操作 | 实心 `--color-accent`，白字，圆角 `--radius-md` |
| secondary | 次要操作 | 边框 `--color-border-default`，透明底 |
| ghost | 工具栏图标按钮 | 无边框，hover 出 `--color-bg-hover` |
| danger | 删除/清空 | `--color-danger`，仅在确认对话框中使用实心 |

尺寸：`sm` 28px / `md` 32px / `lg` 36px；图标按钮为正方形，最小 28×28。
加载态：禁用 + 尺寸不变的 spinner（禁止文字变"加载中…"导致布局跳动）。

## 4. 图标

必需图标（内联 SVG 组件，24×24 视框、1.5px 线宽）：

```
inbox, send, file-edit(drafts), trash, archive, star, star-filled,
search, reply, reply-all, forward, attach, more-horizontal,
chevron-down, chevron-right, refresh, settings, bell, bell-off,
mail-unread, mail-open, external-link, check, close, plus, minus,
account-circle, filter, keyboard, alert-triangle, info, folder
```

## 5. 表单规范

- 标签在输入框上方，字号 `--text-sm`，颜色 `--color-text-secondary`。
- 错误信息在输入框下方，`--text-sm` + `--color-danger`，同时输入框边框变红。
- 必填标记只用 `*`，并在表单顶部说明。
- 校验时机：失焦校验格式，提交校验全部；不在输入过程中打断（除实时搜索）。
- 密码输入：提供显示/隐藏切换，无"记住密码"（凭据由系统管理）。

## 6. 列表行规范（MailRow）

| 元素 | 位置 | 规格 |
| --- | --- | --- |
| 账号色条 | 最左 | 3px 宽，全高，颜色 `--color-account-N` |
| 未读圆点 | 色条右侧 8px | 6px 圆点，仅未读显示 |
| 发件人/收件人 | 第 1 行左 | 13px/500，未读时 600 |
| 时间 | 第 1 行右 | 11px/400，`--color-text-tertiary`，等宽数字 |
| 主题 | 第 2 行 | 13px，未读时 600 |
| 摘要 | 第 3 行 | 12px，`--color-text-secondary`，单行省略 |
| 附件/星标 | 行尾 | 14px 图标，间隔 4px |

选中态：背景 `--color-bg-selected` + 左侧 2px accent 描边；
hover：`--color-bg-hover`；键盘焦点：外描边，不改变背景。

## 7. 空态与骨架

空态必须包含：图标、一句话说明**为什么空**、一个**可执行动作**。

| 场景 | 文案 | 动作 |
| --- | --- | --- |
| 无账号 | 还没有添加邮箱账号 | 添加账号 |
| 收件箱为空 | 收件箱是空的 | 立即同步 |
| 搜索无结果 | 没有找到匹配 `QUERY` 的邮件 | 清除筛选 |
| 同步失败 | 同步未完成：`MESSAGE` | 重试 |

骨架屏：行高与真实行一致，3-6 行；禁止全屏 spinner 覆盖内容。

## 8. 一致性检查清单（新组件合入前）

- [ ] 只用 `--color-*` / `--space-*` / `--text-*` 令牌
- [ ] 五态齐备且有截图
- [ ] 键盘可操作，`Esc` 可退出
- [ ] 有 `aria-*` 语义
- [ ] 深色主题下验证
- [ ] 120% 缩放与 200% 系统字体下不溢出

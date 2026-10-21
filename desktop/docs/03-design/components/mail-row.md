# MailRow 邮件列表行

> 状态：草稿 | 负责人：@design-lead | 最后更新：2026-10-15
> 相关：[VirtualList](virtual-list.md) · [组件规范](README.md) · [FEAT-0002 统一收件箱](../../01-product/features/FEAT-0002-unified-inbox.md)

## 用途

列表中的单封邮件摘要行。信息密度与可扫读性是首要目标：用户应能在 1 秒内判断
"谁发的、什么事、多久之前、要不要现在看"。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `item` | `MailListItem` | — | 见 [FEAT-0002](../../01-product/features/FEAT-0002-unified-inbox.md#4-数据结构与接口影响) |
| `isActive` | `boolean` | `false` | 当前选中 |
| `showAccount` | `boolean` | `true` | 统一收件箱中显示账号色标 |
| `density` | `compact \| comfortable` | `comfortable` | 64px / 80px |
| `onSelect` | `(id: string) => void` | — | 单击 |
| `onContextMenu` | `(e, item) => void` | — | 右键菜单 |

## 布局

```
┌──┬────────────────────────────────────────────┐
│▐ │ 发件人姓名          附件★    ·   14:32      │  行1  13/11px
│  │ 主题：这里是邮件主题（单行省略）              │  行2  13px
│  │ 摘要文本的前 120 字符，灰色，单行省略…        │  行3  12px（comfortable）
└──┴────────────────────────────────────────────┘
 ↑ 3px 账号色条  ↑ 未读圆点（色条内侧 8px）
```

| 元素 | 规格 |
| --- | --- |
| 行高 | 64px（两行）/ 80px（三行） |
| 左右内边距 | `--space-5`（16px） |
| 账号色条 | 3px 宽，全高，`--color-account-N` |
| 未读圆点 | 6px，`--color-unread-dot`，仅未读 |
| 时间 | `--text-xs`，tertiary，等宽数字，右对齐，最小宽 56px |
| 主题 | 单行 `text-overflow: ellipsis` |
| 摘要 | 单行省略，secondary |
| 高亮（搜索） | `<mark>` 背景 `--color-bg-selected`，文字不变色 |

## 状态与视觉

| 状态 | 表现 |
| --- | --- |
| default | 背景透明，无边框 |
| hover | 背景 `--color-bg-hover` |
| active（选中） | 背景 `--color-bg-selected`，左侧 2px accent 描边（覆盖在色条上） |
| unread | 圆点可见；发件人与主题 `font-weight: 600` |
| focus-visible | 2px accent 外描边，背景不变 |
| disabled（同步占位） | 40% 不透明度，`aria-disabled` |

## 键盘与可访问性

- `role="option"`，`aria-selected={isActive}`，`aria-label` 组合为
  `"ACCOUNT_LABEL 未读 主题，来自 发件人，14:32"`（屏幕阅读器可直接读出关键信息）。
- 单独提供 `aria-label` 而非依赖视觉文本拼接。
- 未读状态同时通过圆点与字重表达，不依赖颜色。

## 使用示例

```tsx
<MailRow
  item={item}
  isActive={item.id === selectedId}
  density="comfortable"
  onSelect={selectMail}
  onContextMenu={openContextMenu}
/>
```

## 反例

- 不要在行内放操作按钮（批量操作用悬停工具条或右键菜单）。
- 不要截断发件人姓名到不可辨识（最少保留 12 个字符或 60% 列宽）。
- 不要在行内渲染远程图片（头像需本地或首字母生成）。

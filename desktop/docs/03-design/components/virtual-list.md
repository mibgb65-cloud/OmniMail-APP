# VirtualList 虚拟滚动列表

> 状态：草稿 | 负责人：@frontend-lead | 最后更新：2026-10-15
> 相关：[组件规范](README.md) · [前端架构](../../02-architecture/frontend/README.md)

## 用途

渲染 1 万+ 条邮件列表，保持 60fps。采用**固定行高**避免测量开销；变高行（附件行）
通过两种行高切换实现，不做逐行测量。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` | `T[]` | — | 数据源 |
| `rowHeight` | `number \| ((item: T) => number)` | — | 固定值或两种值的映射 |
| `overscan` | `number` | `6` | 视口外预渲染行数 |
| `selectedId` | `string` | — | 当前选中项（用于滚动定位与 `aria-activedescendant`） |
| `onSelect` | `(id: string) => void` | — | — |
| `onEndReached` | `() => void` | — | 距底部 200px 触发分页 |
| `renderRow` | `(item: T, index: number) => ReactNode` | — | 行渲染 |
| `emptyState` | `ReactNode` | — | 空态 |
| `loading` | `boolean` | `false` | 骨架屏 |

## 状态与视觉

| 状态 | 表现 |
| --- | --- |
| loading | 渲染 6 行骨架，高度与真实行一致 |
| empty | 居中空态（图标 + 文案 + 动作） |
| error | 空态变体 + 重试按钮 |
| loaded | 虚拟窗口渲染，容器 `overflow-y: auto` |

## 键盘与可访问性

- 容器 `role="listbox"`，`tabIndex={0}`，`aria-activedescendant` 指向选中行 `id`。
- 行 `role="option"`，`aria-selected`。
- 键位：`↑/↓` 或 `j/k` 移动、`Home/End` 跳首尾、`PageUp/PageDown` 翻页、`Enter` 打开。
- 选中项移出视口时自动滚动到可见（`scrollIntoView({ block: 'nearest' })`）。
- 滚动区域必须有 `aria-label`（如"邮件列表，共 N 封"）。

## 实现要点

```tsx
const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
const end   = Math.min(items.length, Math.ceil((scrollTop + viewportH) / rowHeight) + overscan);
// 上下各放一个占位 spacer，撑出总高度
<div style={{ height: start * rowHeight }} />
{items.slice(start, end).map((it, i) => (
  <Row key={it.id} style={{ height: rowHeight }} {...} />
))}
<div style={{ height: (items.length - end) * rowHeight }} />
```

- 滚动事件用 `requestAnimationFrame` 节流。
- 行组件 `React.memo`，props 只传必要字段（`item.id`、`isActive`、`onSelect`）。
- 不在滚动中触发数据请求；`onEndReached` 加 300ms 冷却。

## 使用示例

```tsx
<VirtualList
  items={mailItems}
  rowHeight={(m) => (m.hasAttachment ? 80 : 64)}
  selectedId={selectedId}
  onSelect={selectMail}
  onEndReached={loadMore}
  renderRow={(m) => (
    <MailRow item={m} isActive={m.id === selectedId} onSelect={selectMail} />
  )}
  emptyState={<EmptyState title="收件箱是空的" action="立即同步" onAction={sync} />}
/>
```

## 反例

- 不要用 index 作为 key。
- 不要在 `renderRow` 内做数据请求或重计算（会逐行触发）。
- 不要混用高度测量库与固定行高，会导致滚动抖动。

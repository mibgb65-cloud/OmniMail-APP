# Input 输入框

> 状态：草稿 | 负责人：@design-lead | 最后更新：2026-10-15
> 相关：[组件规范](README.md) · [设计系统](../design-system.md)

## 用途

文本、搜索、密码输入。搜索框使用 `kind="search"` 变体（含图标与清除按钮）。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `kind` | `text \| search \| password` | `text` | 变体 |
| `value` / `onChange` | `string` / `(v: string) => void` | — | 受控 |
| `placeholder` | `string` | — | 仅提示，不代替标签 |
| `label` | `string` | — | 必填（可视觉隐藏但必须有） |
| `error` | `string` | — | 错误文案，同时设置 `aria-invalid` |
| `hint` | `string` | — | 辅助说明，错误时隐藏 |
| `disabled` | `boolean` | `false` | — |
| `autoFocus` | `boolean` | `false` | 搜索框聚焦场景使用 |
| `onClear` | `() => void` | — | `search` 变体的清除动作 |

## 状态与视觉

| 状态 | 表现 |
| --- | --- |
| default | 背景 `--color-bg-canvas`，边框 `--color-border-default`，圆角 `--radius-md`，高 32px |
| hover | 边框 `--color-border-strong` |
| focus | 边框 `--color-accent` + 1px 内描边，无外发光 |
| error | 边框 `--color-danger`，下方错误文案 `--text-sm` |
| disabled | 背景 sunken，文字 tertiary |
| loading（搜索） | 右侧显示小 spinner 替代清除按钮 |

## 键盘与可访问性

- `<label>` 与输入框通过 `id` 关联；不可见标签用 `.visually-hidden` 类。
- `aria-invalid` + `aria-describedby` 指向错误文案节点。
- 密码框提供"显示/隐藏"按钮（`aria-pressed`）。
- 搜索框 `Esc` 清空并 blur。

## 使用示例

```tsx
<Input
  kind="search"
  label="搜索邮件"
  placeholder="搜索邮件（Ctrl+K）"
  value={q}
  onChange={setQ}
  onClear={() => setQ('')}
/>
```

## 反例

- 不要用 `placeholder` 充当标签。
- 不要在 `onChange` 中做重 IO（放 debounce）。
- 不要自定义光标样式或移除 `outline` 而不提供替代焦点样式。

# Button 按钮

> 状态：草稿 | 负责人：@design-lead | 最后更新：2026-10-15
> 相关：[组件规范](README.md) · [设计系统](../design-system.md)

## 用途

触发操作。工具栏用 `ghost`，表单用 `secondary`/`primary`，破坏性操作只在确认框内用 `danger`。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `variant` | `primary \| secondary \| ghost \| danger` | `secondary` | 视觉变体 |
| `size` | `sm \| md \| lg` | `md` | 28 / 32 / 36px |
| `iconOnly` | `boolean` | `false` | 正方形图标按钮，**必须**配 `aria-label` |
| `loading` | `boolean` | `false` | 显示 spinner，尺寸不变，禁用点击 |
| `disabled` | `boolean` | `false` | — |
| `fullWidth` | `boolean` | `false` | 撑满容器（对话框底部） |
| `leadingIcon` | `ReactNode` | — | 前置图标 |
| `onClick` | `() => void` | — | — |

## 状态与视觉

| 状态 | primary | secondary | ghost | danger |
| --- | --- | --- | --- | --- |
| default | 背景 accent，文字白色 | 透明底，边框 default | 透明 | 背景 danger |
| hover | accent-hover | 背景 `--color-bg-hover` | 背景 `--color-bg-hover` | danger 提亮 8% |
| active | 再深 8% | 背景 sunken | 背景 sunken | 再深 8% |
| focus-visible | 2px accent 外描边 + 2px 偏移 | 同左 | 同左 | 2px danger 外描边 |
| disabled | 40% 不透明度，`cursor: not-allowed` | 同左 | 同左 | 同左 |

## 键盘与可访问性

- 原生 `<button>`，`type` 默认 `"button"`（防止在表单中意外提交）。
- `Enter` / `Space` 触发。
- `loading` 时设置 `aria-busy="true"` 并 `disabled`。
- `iconOnly` 必须提供 `aria-label`，并配 `Tooltip`。

## 使用示例

```tsx
<Button variant="primary" leadingIcon={<PlusIcon />} onClick={openAccountDialog}>
  添加账号
</Button>

<Button variant="ghost" iconOnly aria-label="同步">
  <RefreshIcon />
</Button>
```

## 反例

- 不要在一屏放两个 `primary`。
- 不要用按钮模拟链接（导航用 `<a>`）。
- 不要自造加载文案替换按钮文字（导致布局抖动）。

# Button 按钮

> 状态：草稿（含当前实现） | 负责人：@design-lead | 最后更新：2026-10-31
> 相关：[组件规范](README.md) · [设计系统](../design-system.md)

## 用途

触发操作。工具栏用 `ghost`，表单用 `secondary`/`primary`，破坏性操作只在确认框内用 `danger`。

## 当前实现：基础层与视觉变体（TASK-0053）

- 当前仍使用原生 `<button>`，并未实现下文设想的通用 React `Button` 组件或全部 Props。
- `frontend/src/styles/globals.css` 的按钮默认/hover/active/disabled 位于低优先级
  `@layer button-defaults`；各 CSS Module 组件的非分层样式优先，不依赖 import 顺序或叠加 `!important`。
- 未声明变体的按钮保持现有主按钮默认配色。工具栏使用 `data-button-variant="ghost"`，
  同步、排序及清除筛选使用 `data-button-variant="secondary"`（带细边线）。
  两者默认透明、次级前景；hover 使用 `--color-bg-selected` 与 `--color-text-primary`，
  active 使用 `--color-bg-sunken`；disabled 不响应悬浮并保留透明底，游标为 `not-allowed`。
- 共同状态通过 `--button-background` / `--button-foreground`、
  `--button-hover-background` / `--button-hover-foreground`、
  `--button-active-background` / `--button-disabled-background` /
  `--button-disabled-foreground` 配对定义。组件若希望复用默认状态，应只覆写所需变量，
  避免再次用非分层的固定 background 把主按钮自身的 hover/disabled 状态锁死。
- 自定义组件的状态仍由所属 CSS Module 管理，键盘焦点沿用全局 focus-visible 轮廓；
  工具栏仅共享视觉行为，不改变禁用条件、同步进度、提示或邮件操作。

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

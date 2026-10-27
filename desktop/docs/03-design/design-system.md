# 设计系统

> 状态：草稿 | 负责人：@design-lead | 最后更新：2026-10-25
> 相关：[组件规范](components/README.md) · [页面规格](pages/README.md) · [设计资源](assets/README.md)

---

## 1. 设计原则

1. **信息密度优先**：桌面客户端用户要一次看到更多邮件，拒绝"大留白营销风"。
2. **键盘优先**：所有高频动作有快捷键；鼠标是补充。
3. **状态可见**：同步、保存、发送、失败，每一步都有可读反馈，不静默。
4. **克制的动效**：仅用于空间转换（面板开合、列表插入），时长 120-200ms。
5. **可访问**：对比度、焦点、语义结构、减少动态偏好全部达标。

## 2. 令牌体系（三层）

```
primitive（原始值） → semantic（语义） → component（组件变量）
```

CSS 变量命名：`--<layer>-<category>-<variant>`。只允许组件使用 `component` 层，页面使用 `semantic` 层。

### 2.1 颜色 · 语义层

```css
:root {
  /* 表面 */
  --color-bg-canvas:      #ffffff;
  --color-bg-surface:     #f7f8fa;
  --color-bg-elevated:    #ffffff;
  --color-bg-sunken:      #eef0f3;
  --color-bg-selected:    #e8f0fe;
  --color-bg-hover:       #f0f2f5;

  /* 文本 */
  --color-text-primary:   #1a1d21;
  --color-text-secondary: #5c6470;
  --color-text-tertiary:  #8a929e;
  --color-text-inverse:   #ffffff;
  --color-text-link:      #1a63d8;

  /* 边框 */
  --color-border-subtle:  #e6e8eb;
  --color-border-default: #d5d8dd;
  --color-border-strong:  #b9bec6;

  /* 语义 */
  --color-accent:         #1a63d8;
  --color-accent-hover:   #1550b3;
  --color-danger:         #c62828;
  --color-warning:        #b26a00;
  --color-success:        #1e7a3c;
  --color-unread-dot:     #1a63d8;

  /* 账号着色（6 色循环，含深色模式变体） */
  --color-account-1: #1a63d8;
  --color-account-2: #0f8a6a;
  --color-account-3: #b2660f;
  --color-account-4: #7b3fc4;
  --color-account-5: #b03060;
  --color-account-6: #2b6f8f;
}

[data-theme='dark'] {
  --color-bg-canvas:      #16181c;
  --color-bg-surface:     #1c1f24;
  --color-bg-elevated:    #23272d;
  --color-bg-sunken:      #121418;
  --color-bg-selected:    #1e3352;
  --color-bg-hover:       #262b31;

  --color-text-primary:   #e8eaed;
  --color-text-secondary: #a2a9b4;
  --color-text-tertiary:  #6f7783;
  --color-text-link:      #6da6f5;

  --color-border-subtle:  #2a2f36;
  --color-border-default: #363c45;
  --color-border-strong:  #4a515b;

  --color-accent:         #4d8ef0;
  --color-accent-hover:   #6da6f5;
  --color-danger:         #ef6b6b;
  --color-warning:        #e0a33a;
  --color-success:        #4caf72;
  --color-unread-dot:     #4d8ef0;
}
```

> 令牌值需用对比度工具验证：正文 ≥ 4.5:1，大字/图标 ≥ 3:1。

### 2.2 间距（4px 基准）

```css
--space-0: 0;      --space-1: 2px;   --space-2: 4px;
--space-3: 8px;    --space-4: 12px;  --space-5: 16px;
--space-6: 20px;   --space-7: 24px;  --space-8: 32px;
--space-9: 40px;   --space-10: 48px; --space-11: 64px;
```

用途约定：组件内边距 `3/4/5`，区块间距 `6/7`，页面留白 `8/9`。

### 2.3 字体与排版

```css
--font-sans: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;

--text-xs:   11px / 16px;   /* 辅助信息、时间戳 */
--text-sm:   12px / 18px;   /* 列表次要信息 */
--text-base: 13px / 20px;   /* 默认正文（桌面密度） */
--text-md:   14px / 22px;   /* 邮件正文 */
--text-lg:   16px / 24px;   /* 标题 */
--text-xl:   20px / 28px;   /* 页面标题 */
--text-2xl:  24px / 32px;   /* 空态标题 */

--weight-regular: 400;
--weight-medium:  500;
--weight-semibold: 600;
```

字体族顺序必须包含中文回退；`font-feature-settings: "tnum"` 用于数字对齐（未读数、时间）。

### 2.4 圆角、阴影、层级

```css
--radius-sm: 4px;  --radius-md: 6px;  --radius-lg: 10px;  --radius-pill: 999px;

--shadow-1: 0 1px 2px rgba(16, 18, 22, .06);
--shadow-2: 0 4px 12px rgba(16, 18, 22, .10);
--shadow-3: 0 12px 32px rgba(16, 18, 22, .16);

--z-sidebar: 10; --z-toolbar: 20; --z-dropdown: 100; --z-modal: 1000; --z-toast: 1100;
```

### 2.5 尺寸与栅格

| 元素 | 尺寸 |
| --- | --- |
| 侧栏宽度 | 240px（可折叠到 56px 图标栏） |
| 列表列宽 | 320 / 360 / 400px 可拖拽，记忆用户选择 |
| 工具栏高度 | 48px |
| 列表行高 | 64px（单行摘要）/ 80px（两行 + 附件） |
| 输入框高度 | 32px（紧凑）/ 36px（表单） |
| 按钮高度 | 28px（工具栏）/ 32px（表单）/ 36px（主操作） |
| 触达最小点击区 | 28×28px（桌面）；图标按钮内边距保证 |

## 3. 主题

- `data-theme="light|dark|system"`；`system` 通过 `matchMedia('(prefers-color-scheme: dark)')` 解析。
- 切换即时生效，无刷新；写入设置并在下次启动恢复。
- 邮件正文 iframe 内同步注入主题变量（[FEAT-0007](../01-product/features/FEAT-0007-safe-html-render.md)）。

## 4. 动效

| 场景 | 时长 | 曲线 |
| --- | --- | --- |
| 面板开合 | 160ms | `cubic-bezier(.2, .8, .3, 1)` |
| 行插入/删除 | 120ms | `ease-out` |
| Toast 进出 | 200ms | `ease-out` / 150ms `ease-in` |
| Hover 状态 | 80ms | `linear` |

`@media (prefers-reduced-motion: reduce)` 下全部降为 0ms（保留状态变化，去掉位移）。

## 5. 图标

- 单色线性功能图标，24×24 视框、默认显示 18px，线宽统一 1.6，`stroke="currentColor"`。
- 经用户确认接入 Morphicons，通过 `components/UiIcon/` 渲染静态按需引用的 Lucide 描边和本地实心图形数据；
  不全量导入或使用远程图标。依赖、许可和添加规范见 [功能图标](components/icons.md)。
- 软件品牌 SVG、PNG 和原生图标仍使用独立品牌资源，不随功能图标库替换。
- 必用场景清单见 [组件规范 §4](components/README.md#4-图标)。

## 6. 可访问性基线

| 项 | 要求 |
| --- | --- |
| 对比度 | 正文 4.5:1，大字/图标 3:1，禁用态可低于（但需有其他提示） |
| 焦点 | `:focus-visible` 2px 描边 + 2px 偏移，颜色 `--color-accent` |
| 键盘 | 所有功能可达；模态框内焦点陷阱；`Esc` 关闭 |
| 语义 | 列表用 `listbox/option`，弹窗用 `dialog`，状态用 `aria-live` 播报 |
| 状态传达 | 不只用颜色（未读 = 圆点 + 字重） |
| 缩放 | 100%-200% 无横向滚动、无内容截断 |

## 7. 反例（明确禁止）

- 禁止引入第二套 UI 框架（如 MUI/AntD）与现有组件混用。
- 禁止硬编码颜色值；禁止在组件里写 `#fff`、`rgba(...)`。
- 禁止用 emoji 作为功能图标。
- 禁止全屏遮罩式加载；用局部骨架屏。
- 禁止无取消入口的模态框。

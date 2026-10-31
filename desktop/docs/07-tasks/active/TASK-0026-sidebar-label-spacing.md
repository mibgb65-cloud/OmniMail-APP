# TASK-0026 收紧侧栏“工作空间”分组标题上下留白

> 状态：待评审 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P2

## 需求与范围

- 用户截图指出侧栏“工作空间”这行分组标题上下间距过宽，要求收紧。
- 只调整分组标题与上方“写邮件”按钮、下方分类列表之间的垂直留白；不改字号、颜色、分类顺序、图标、选中动效与交互，不涉及后端。

## 分析与计划

- 现状（`App.module.css`）：`.compose-button` 的下外边距为 `--space-7`（24px），`.sidebar-label` 下外边距 `--space-4`（12px），`.nav-pending` 上外边距 `--space-2`（4px），合计标题上方 24px、下方 16px。
- 计划：上方改为 `--space-4`（12px），标题下外边距改为 `--space-1`（2px），列表外边距不动，得到上方 12px、下方 6px；标题因此更贴近它所属的分类列表，层级关系不变。
- 用运行中的 Wails dev 窗口 + Vite 热更新核对，不重新打包、不跑完整 `verify`。

## 验收标准

- [x] “工作空间”上方留白由 24px 收到 12px，下方由 16px 收到 6px。
- [x] 分类列表、选中滑块、图标变形、动效与点击行为不受影响；窄屏媒体查询下标题仍隐藏。

## 实现与验证

- `App.module.css`：`.compose-button` `margin-bottom` 由 `var(--space-7)` 改为 `var(--space-4)`；`.sidebar-label` `margin` 由 `0 var(--space-4) var(--space-4)` 改为 `0 var(--space-4) var(--space-1)`。
- 像素实测（同窗口同坐标截图，按文字行带测量）：标题文字带上移 12px；首个分类“全部收件箱”文字带上移 22px；标题底部到首个分类文字顶部由 32px 收到 22px。
- `npm run test -- src/app/WorkspaceSidebar`：10 项通过；`npm exec -- prettier --check src/app/App.module.css` 通过。
- 截图：`desktop/.devdata/previews/sb-step1-zoom.png`（改后侧栏）、`sb-aligned-before-after.png`（前后同坐标对比）。
- 未验证：窄屏媒体查询下的实际渲染（该断点本就 `display: none` 隐藏标题，仅按源码判断）；未重新打包，未做其他平台实测。

## Git 与风险

- 未授权提交或推送；不暂存、不归档，待用户评审。
- 风险：留白数值为一次性视觉取舍，若用户希望更紧可继续改 `--space-*` 档位；标题隐藏的窄屏断点不受本次改动影响。

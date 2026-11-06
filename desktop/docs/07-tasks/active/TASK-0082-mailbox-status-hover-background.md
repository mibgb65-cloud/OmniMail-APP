# TASK-0082 邮箱状态点去除悬停底色

> 状态：待评审
> 负责人：@Codex | 创建：2026-11-01 | 优先级：P2

## 需求与范围
用户要求移除邮箱状态点鼠标悬浮时的灰色背景，但保留悬浮提示。
仅调整状态点按钮局部 CSS，不修改整行选中/悬停、状态颜色、提示内容、重试及同步逻辑。

## 分析与计划
- `MailboxStatus.module.css` 为 `.trigger:hover` 和 `[aria-expanded=true]` 设置了灰底；
  提示展开后即使鼠标移走也会保留小方块，须同时去除两种状态的背景。
- 基础 `.trigger` 已为透明底，且高于全局 button-defaults 层；去掉额外覆盖即可。
- 先以真实浏览器复现 hover/展开背景，再做最小样式修改；验证亮暗、提示保留、提示内移动、
  失败重试和键盘聚焦，不移除可访问焦点轮廓。
- 小范围纯样式变更，采用局部格式检查、现有状态/账号组件测试和浏览器样式检查；
  不跑 Go/全量 verify，原因是没有逻辑、接口、依赖或构建变更。

## 验收
- [x] 状态点悬浮、提示展开和鼠标移入提示时均无独立灰色底块。
- [x] 状态色、悬浮/聚焦提示、真实计数和错误重试保持可用。
- [x] 亮暗两套通过，保留整行状态与键盘焦点。

## 实现与验证
- 仅删除 `MailboxStatus.module.css` 中 hover/展开时设置背景和前景色的规则，沿用基础透明背景。
  状态点组件、Popover、计数、重试和整行样式均未改动。
- 页面规范补充“状态点保持透明，提示和键盘焦点不变”。

## 验证记录（2026-11-01）
| 命令/核对 | 实际结果 |
| --- | --- |
| `node desktop/.task/t82-status-browser-check.mjs`（修改前） | 在有效布局中复现失败：悬浮/展开按钮背景为 `rgb(238, 238, 240)`，不是透明；日志 `.task/t82-browser-before.log` |
| `npx prettier --check src/app/MailboxStatus.module.css` | 通过 |
| `npx vitest run src/app/MailboxStatus.test.tsx src/app/MailboxAccounts.test.tsx src/app/MailboxProviders.test.tsx` | **3 文件 / 28 项通过** |
| `node desktop/.task/t82-status-browser-check.mjs`（最终） | **通过**：亮暗均为透明背景，悬浮/展开/移入提示及键盘焦点不产生方块；真实 props 计数显示、提示保持、焦点轮廓和错误重试可用；日志 `.task/t82-browser-after.log` |
| `git diff --check` | 通过 |

浏览器夹具使用合成邮箱与固定计数，没有访问真实用户账号。
初始夹具需要给 flex 滚动容器明确高度；键盘焦点在状态点内时提示应保持，
脚本已按现有语义在下一轮鼠标检查前移出焦点，没有为测试修改提示逻辑。

未运行 Go、类型检查、前端全量测试或完整 verify：本轮唯一生产变更是删除局部 CSS，
没有修改 JS/TS、接口、配置或依赖；局部组件测试与真实浏览器计算样式检查覆盖此次风险。
未单独执行 Wails 原生 UI 冒烟，不将浏览器测试称为桌面或实际同步验收。

## Git 与交付
未授权提交/推送；未提交、未归档。保留所有既有混合修改，待本轮评审。

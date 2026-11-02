# TASK-0086 关于页去掉重复圆角卡片、改为简洁排版

> 状态：已完成
> 负责人：@Codex | 创建：2026-11-01 | 优先级：P2
> 实现提交：`072367750f3f99ff03a655f9aa63b7c59ffe1cc2`（未推送）

## 需求与范围
用户反馈设置“关于”页圆角矩形框过多、层层重复，要求修改排版、整体更简洁。

范围：`SettingsAbout`、`ConnectionPanel` 及两者的样式。
不做：不改动连接检查、版本读取、重播开屏等行为；不改动其他设置分类的卡片样式；
不改文案与本地化键；不引入新依赖。

## 分析与计划
- 当前“关于”页存在三层嵌套容器：`SettingsDialog` 的 `.card`（描边＋圆角＋底色）内再放
  `ConnectionPanel` 的 `.connection-panel`（描边＋圆角＋底色＋阴影），“下一阶段”三个步骤各自
  还有一层 `--color-bg-surface` 圆角块；页面整体视觉只剩同一种圆角矩形，层级靠框线区分。
- 改为扁平信息排版：外层卡片取消，用 1px 细分隔线划分区块；连接区去掉自带框体和阴影，
  只用小标题＋右上文字按钮＋状态行＋四列等宽元数据；步骤改为序号＋标题＋说明的三列文本块，无底色无圆角。
- `ConnectionPanel` 目前只被“关于”页使用，可安全改为无框结构：为它新建独立 CSS Module，
  删除 `App.module.css` 中随之失效的连接面板规则，保留 `.replay`／`.icon` 供页脚复用。
- 风险：分隔线与层级在亮暗两套主题下的可见度；窄窗口（≤680px）下三列步骤需要回落为单列；
  删除 CSS 时避免误删其它页面仍在用的共享类（`.metadata` 仍被“软件更新”使用）。

## 验收
- [x] “关于”页没有外层卡片框、没有嵌套连接面板框、没有步骤底色块。
- [x] 连接状态、版本／提交／Go 版本／平台／构建时间、重播开屏按钮仍可用。
- [x] 亮暗两套主题、宽窗口与窄窗口下排版不溢出、不重叠。
- [x] 相关单测与前端格式／静态检查通过。

## 实现与验证
- `SettingsAbout.tsx`：外层由 `.card` 改为扁平 `.about`；顺序为标识（图标＋名称＋开发预览）、一句话说明、
  工作台引导、桌面服务连接、下一阶段三步、页脚（技术栈＋重播开屏）。区块之间用细分隔线，不再嵌套卡片。
- `SettingsAbout` 仍兼容三种连接态：有 `connectionState` 时复用 `ConnectionPanel`，只有 `versionInfo`
  时用共享元数据列表兜底，都没有时显示“版本不可用”。
- `ConnectionPanel` 新建 `ConnectionPanel.module.css`：去掉描边、圆角、底色与阴影；“检查连接”改为
  页签内文字按钮（ghost 变体），状态行用小色点，失败态用左侧 2px 语义色竖线而非色块；
  元数据改为 `auto-fit` 等宽列，构建时间独占一行。
- `SettingsDialog.module.css`：新增 `.about-*` 规则并删除 `.development-*`；`.metadata` 保留给
  “软件更新”使用，仅新增 `.about-block .metadata` 覆盖以去掉重复分隔线；窄窗口三列步骤回落单列。
- `App.module.css`：删除随旧面板结构失效的 `.connection-panel`／`.next-panel`／`.panel-heading`／
  `.muted`／`.success`／`.error`／`.metadata*`／`.skeleton`／`.eyebrow` 及对应媒体查询项；
  `.replay`、`.icon` 仍被“关于”页脚复用，保持不变。

## 验证记录（2026-11-01）
| 命令/核对 | 实际结果 |
| --- | --- |
| `npx prettier --check`（5 个改动源文件） | 通过 |
| `npx eslint src/components/SettingsDialog src/app/ConnectionPanel.tsx --max-warnings 0` | 通过 |
| `npx tsc --noEmit` | 通过 |
| `npx vitest run src/components/SettingsDialog src/lib/i18n` | **12 文件 / 100 项通过** |
| `npx vitest run`（全量前端） | **91 文件 / 786 项通过** |
| `npx vite build` | 构建成功（沿用既有 >500 kB 分包告警） |
| `node .task/t86-about-browser-check.mjs`（合成数据，Chromium） | 通过：亮/暗、成功/失败连接态、宽窗口与 560px 窄窗口 |
| `git diff --check` | 通过 |

浏览器核对的断言：关于页内容里不再存在“圆角＋底色”容器（仅剩两个透明底文字按钮本身带按钮圆角）；
宽窗口三个步骤同一行、无底色；窄窗口三步纵向排列且面板无横向溢出；失败态告警无圆角无底色、
仅保留 2px 左侧竖线，且“检查连接”仍可点击。
截图与脚本位于 `desktop/.task/t86-about-*`（未纳入版本库），使用合成版本号与连接状态，未读取真实账号。

未运行 Go 侧测试与完整 `verify`：本轮只改前端 JSX 与 CSS Modules，未触及 Go、接口、依赖或构建配置；
已用前端全量测试＋类型检查＋构建覆盖。未做 Wails 桌面实机视觉冒烟，浏览器预览不能替代桌面验收。

## Git 与交付
已按用户 2026-11-02 授权随本地 0.0.2 基线提交，实现提交
`072367750f3f99ff03a655f9aa63b7c59ffe1cc2`，父提交
`5c97c37cc40621a90e5b9b0ef7d4b5f7d5ab8674`；文档与任务登记在后续 docs 提交。
未推送、未发布 GitHub Release，也不代表桌面实机验收。

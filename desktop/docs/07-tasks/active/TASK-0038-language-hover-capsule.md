# TASK-0038 语言切换悬停横向展开胶囊

> 状态：进行中
> 负责人：@Codex | 创建：2026-10-28 | 优先级：P1
> 关联：TASK-0004 / TASK-0007

## 需求与目标

将语言切换的点击下拉菜单替换为悬停或键盘聚焦横向展开的胶囊。保留当前
react-i18next、I18nProvider、locale 读取、setLocale 回调与偏好持久化行为，
复用现有主题 Token，不增加依赖或硬编码颜色。

## 范围

### 包含

- 顶部栏语言入口及设置中的共享语言选择组件。
- 收起显示翻译图标与当前语言简写，hover / focus-within 展开全部实际支持语言。
- 语义化选中态、键盘可达性、焦点反馈与减少动态效果偏好。
- 移除不再使用的语言下拉菜单呈现、定位及生命周期代码，更新相关测试与现行文档。

### 不包含

- 国际化状态、翻译引擎、系统语言检测、语言存储协议及邮件业务行为。
- 改动其他菜单、全局主题配色或引入组件/动画依赖。
- Git 提交、推送及任务归档。

## 分析

- 初始 `git status --short` 为空，无用户既有改动。
- 顶部栏使用 LanguageMenu；设置使用 LanguageSwitcher 包装同一菜单，
  共同依赖 useLanguageMenu 与 placeLanguageMenu 实现 Popover 和键盘生命周期。
- `useTranslation('common')` 返回既有 `locale` / `setLocale`；
  `SUPPORTED_LOCALES` 为 `zh-CN`、`en`，无需重建语言状态。
- 现有 CSS Modules 与 `styles/tokens.css` 已提供明暗主题、主次文字、
  容器背景、选中背景、边框及焦点规范。进一步核对邻近按钮尺寸与 SVG 图标后实施。
- 采用共享胶囊与 CSS hover / focus-within，避免新增弹窗或全局事件监听；
  两个入口保持同一套语言逻辑。
- 图标复用 UiIcon 的 Lucide Languages SVG（文/A），尺寸复用 16px 间距 Token；
  胶囊按需求取 34px。原顶部工具按钮为 40px；视觉核对后追加局部高度对齐，
  将紧邻主题按钮同步为 34px，宽度与原生窗口控制按钮保持不变。
- 使用现有 `color-bg-surface`、`color-bg-selected`、`color-bg-sunken`、
  `color-border-subtle`、`field-border-hover` 和主次文字 Token；全局已支持减少动态效果。
- 收起时非选中按钮补充 visibility 隐藏，防止不可见项抢占键盘焦点；
  聚焦当前项后所有选项可达，方向键/Home/End 只移动焦点，不擅自切换语言。

## 实施计划

1. [x] 核对相关规范、样式、图标及测试，先补齐交互验收测试。
2. [x] 替换共享组件、接入顶部栏并移除旧菜单依赖（每步不超过 10 文件 / 600 行变更）。
3. [x] 更新国际化与应用集成测试、清理遗留文件/Token、同步现行文档。
4. [x] 执行定向测试、完整 verify、浏览器交互与主题检查，审阅差异并回填记录。

## 验收标准

- [x] 收起只显示图标和当前语言简写；hover / focus-within 平滑横向展开。
- [x] 点击立即切换且沿用原持久化、页面语言和状态保持行为。
- [x] 选项具备完整语言标签、标题及选中语义；键盘可进入、切换和离开。
- [x] 颜色均来自现有 Token，明暗模式正常，无横向文字换行或弹窗依赖。
- [x] 定向测试与完整 verify 通过，浏览器验证与桌面验证边界明确。

## 风险与依赖

- CSS 动画、实际尺寸及焦点展开需要真实浏览器验证，不能仅依赖 jsdom。
- 已运行的开发桌面窗口需保留；verify 使用独立构建目录，不覆盖其可执行文件。

## 实现结果

- 共享 LanguageSwitcher 直接使用原有 locale / setLocale；顶部栏与设置页共用胶囊。
- 复用现有翻译 SVG 与主题 Token；CSS 负责 hover / focus-within 展开，
  原生按钮承载完整语言名、选中状态与点击确认，方向键辅助移动焦点。
- 分步移除原菜单组件、定位/生命周期 Hook、专属样式与 Token；
  原有弹窗专属测试不再适用，替换为胶囊验收测试并继续保留 Provider/应用行为回归。
- 胶囊与相邻主题按钮高度统一为 34px，SVG 为 16px；语言简写进入两种语言的
  common 资源，locale key、Provider、检测与存储实现均未更改。
- 展开时对 visibility 单独使用零时长，修复聚焦后立即导航的首帧边界；
  宽度、透明度、内边距和颜色保持指定的 0.28s 曲线，全局减少动态效果仍生效。
- 未新增依赖、未修改接口/数据格式；开发与页面现行文档已同步，历史任务记录保留原貌。

## 验证记录

| 日期 | 命令或核对项及覆盖范围 | 实际结果/失败原因 |
| --- | --- | --- |
| 2026-10-28 | `git status --short`、现有语言入口/Provider/Token 检索 | 工作树干净；已定位共享菜单与原状态回调 |
| 2026-10-28 | `npm test -- src/components/LanguageSwitcher/LanguageSwitcher.test.tsx`（实现前） | 修正测试文件多余闭合符后，7 个测试均因缺少胶囊/语言按钮而失败，确认旧交互不符合验收 |
| 2026-10-28 | 同上（替换实现后） | 1 文件 / 7 测试通过 |
| 2026-10-28 | `npm test -- src/components/TitleBar src/components/SettingsDialog src/components/LanguageSwitcher src/lib/i18n src/app/App.test.tsx` | 10 文件 / 106 测试通过 |
| 2026-10-28 | Chromium 实际样式及收起后立即聚焦并按 Home 的边界复现 | 高 34px、图标 16px、收起 78px / 展开约 113px；发现 visibility 动画首帧会阻止立即移动焦点，补充展开时 visibility 零时长覆盖，尺寸/颜色等仍按指定曲线过渡 |
| 2026-10-28 | `go -C desktop tool wails3 task verify`（最终样式修正后重新执行） | 退出码 0；Go/前端格式、vet/lint、类型检查、Go 测试、26 文件 / 256 项前端测试及 Windows 构建全部通过；产物在 `.task/verify-bin/` |
| 2026-10-28 | 本地缓存 Playwright + Chromium，访问现有 Vite 9245 服务 | 明暗主题、两种当前语言、收起/hover/focus-within、Tab/Shift+Tab、方向键/Home/End、Enter/Space、点击与刷新恢复偏好通过；设置内切换不关闭对话框，Esc 保留原关闭行为 |
| 2026-10-28 | Chromium 尺寸与媒体偏好检查 | 胶囊和相邻主题按钮均 34px，SVG 16px；960/1280/1600px 展开无页面横向溢出；reduce 模式过渡 0s |
| 2026-10-28 | Chromium 收起后同一脚本任务内聚焦并触发 Home 回归 | 修复后可立即从英语项移动到中文项，不等待动画首帧 |
| 2026-10-28 | `git diff --check`、现行源码/文档旧菜单引用与胶囊颜色常量检索 | 无空白错误、无旧菜单引用、无新增 hex/rgb 颜色；生成绑定未产生 Git 差异 |
| 2026-10-28 | 既有桌面开发进程检查 | OmniMail 窗口仍存在且响应正常；未关闭或覆盖正在运行的可执行文件，不等同于原生 WebView 全交互验收 |

浏览器验证使用工具缓存，不改项目依赖。预览截图和检查摘要保存在仓库外：
`C:/Users/mimanchi/.codex/visualizations/2026/10/28/01a1805f-14de-78e1-82f1-58a70b8e617d/language-capsule-qa.json`，
同目录的 `language-capsule-light.png` / `language-capsule-dark.png` 为顶部栏预览。

## Git 与交付

- 提交/推送授权：均未授权。
- 关联实现提交：未提交。
- 用户既有改动：无；实施期间出现的其他任务改动保留。
- 遗留风险与未验证项：浏览器不具备原生 Go IPC，空闲请求超时可观察到 Wails runtime 的
  CancelledRejectionError；在不进行语言操作的重载页面也能复现，未扩大范围修改桥接。
  本次未声称邮件收发、原生窗口控制或完整桌面桥接端到端已验证；macOS/Linux 与读屏器实测未覆盖。
- 交付状态：实现/验证已回填，未提交，待评审。
- 文档更新：已更新国际化约定、启动/工作台交互说明与 active 索引。
- 归档日期：未归档。

## 2026-10-28 连续调整：选中胶囊滑动回弹

### 本轮需求与分析

- 用户希望语言切换时，选中高亮具有贝塞尔曲线驱动的滑动回弹。
- 当前选中背景分别绘制在按钮上，只能做颜色切换，无法呈现连续位移。
- 使用单个共享高亮层，通过 transform 在两个等宽语言槽位之间滑动；
  采用 `cubic-bezier(0.34, 1.56, 0.64, 1)` 产生轻微越界与回弹，不新增动画库或状态。
- 两个语言槽位统一为 44px，避免动态测量、切换导致的宽度抖动以及额外布局监听；
  外层高度、图标、颜色 Token、悬停展开及 locale / setLocale 均保留。
- 工作树是本任务上一轮未提交成果，全部保留；不提交或覆盖其他任务改动。

### 本轮实施计划与验收

1. [x] 先补充共享高亮及连续切换的验收测试，确认旧实现不能满足。
2. [x] 增加单个装饰性高亮层，替换按钮独立选中背景并添加回弹曲线。
3. [x] 验证双向/快速连续切换、收起展开、明暗主题及减少动态效果，执行完整 verify。
4. [x] 更新交互文档与本记录，保留待评审和未提交状态。

### 本轮实现与验证

- 已实现共享装饰高亮，位移 460ms，轻微回弹；按钮等宽且保留 DOM 身份，
  连续点击只重定向 CSS transition，无额外动画状态或计时器。
- hover/focus-within 继续控制高亮显隐；外层裁切避免收起时残余高亮溢出；
  非选中项 hover 反馈不遮挡已选中项的共享滑块。
- 本轮调整前的定向测试：新增要求导致 3 项失败、5 项通过（缺少共享高亮层）。
- 本轮实现后定向测试：`npm test -- src/components/LanguageSwitcher src/lib/i18n src/components/TitleBar src/components/SettingsDialog src/app/App.test.tsx`，10 文件 / 107 项通过。
- 真实 Chromium 按帧采样：向英语目标 44px 滑动的峰值约 48.30px，
  返回中文目标 0px 的谷值约 -4.30px，最终分别稳定在 44px / 0px。
  80ms 间隔连续切换 5 次后正确到达最终选项，偏好存储一致。
- reduce 模式下实际点击后过渡为 0s，位移即时定位；收起时高亮透明、
  非当前按钮宽度为 0；键盘切换及明暗主题检查通过。
- `go -C desktop tool wails3 task verify`：退出码 0；格式、静态检查、类型检查、
  Go 测试、26 文件 / 257 项前端测试与独立目录 Windows 构建全部通过。
- 实际逐帧数据记录在仓库外
  `C:/Users/mimanchi/.codex/visualizations/2026/10/28/01a1805f-14de-78e1-82f1-58a70b8e617d/language-capsule-bounce-qa.json`，
  同目录 `language-capsule-bounce-dark.png` 为深色预览。
- 本轮没有变更国际化状态、依赖、接口或数据格式；前述原生 WebView / Go IPC
  验证边界继续适用。未提交、未推送、未归档，待评审。

## 2026-10-28 连续调整：修复选中项悬停变暗

### 本轮需求与初步分析

- 用户截图中，浅色主题下鼠标移入当前中文项后出现深色底、深色字，视觉层级和可读性异常。
- 当前全局 `button:hover:not(:disabled)` 使用 `color-accent-hover` 背景；
  共享滑块替换后，组件只覆盖了未选中项 hover，没有显式覆盖当前项 hover，
  全局规则的优先级高于 `.option` 的透明背景。
- 修复限定在语言组件的 hover 样式，不改全局按钮、主题 Token、滑块回弹或语言逻辑。
- 工作树仍是此前本任务未提交成果，保留所有累计修改。

### 本轮计划与验收

1. [x] 在真实浏览器分别悬停当前项与未选中项，复现并记录层叠结果；先补失败回归。
2. [x] 补充局部 hover 背景重置，保持共享选中层和未选中项的轻反馈。
3. [x] 验证两种语言、明暗主题、滑动回弹与键盘状态，运行相应门禁并回填。

### 本轮实现与验证

- Chromium 先等待胶囊展开稳定，再精确悬停当前项（确认 `matches(':hover')` 为真），
  复现按钮背景 `rgb(65, 65, 70)`、文字 `rgb(32, 32, 35)`，透明背景断言失败。
  仅悬停胶囊中心不足以覆盖此缺陷：展开时按钮位置变化，鼠标可能最终落在另一项。
- 只新增 `.option:hover:not(:disabled) { background: transparent; }` 局部重置，
  优先级高于全局按钮 hover；未选中项既有更具体选择器继续提供轻反馈。
  不修改滑块、回弹参数、主题 Token 或语言回调。
- 补充样式契约单测，避免再次遗漏 hover 重置；jsdom 不代替真实浏览器伪类验证。
  初始 raw CSS 导入/模块 URL 读取与 Vitest 实际环境不兼容，已调整为从约定的前端
  工作目录读取样式源码；随后修复前断言正确失败（1 失败 / 8 通过），修复后通过。
- 定向回归：`npm test -- src/components/LanguageSwitcher src/lib/i18n src/components/TitleBar src/components/SettingsDialog src/app/App.test.tsx`，10 文件 / 108 项通过。
- 完整门禁：`go -C desktop tool wails3 task verify`，退出码 0；
  Go 检查/测试、前端格式/lint/类型检查、26 文件 / 258 项测试和 Windows 构建全部通过。
- 真实浏览器覆盖明暗主题 × 当前中文/英语 × 选中/未选中项 hover 的 8 种状态；
  当前项透明，底色由滑块绘制，未选中项轻反馈正常。
  选中项文字与可见滑块底色对比度为浅色约 14.02:1、深色约 10.75:1。
- 回弹仍达到约 48.30px 后回到 44px；减少动态效果为 0s，End/Enter 键盘切换通过。
- 修复后预览与验证摘要位于仓库外
  `C:/Users/mimanchi/.codex/visualizations/2026/10/28/01a1805f-14de-78e1-82f1-58a70b8e617d/language-hover-fixed-light.png`
  与同目录 `language-hover-regression-qa.json`。
- 本轮无依赖、接口、数据变更；原生 WebView/Go IPC 实测边界不变。
  未提交、未推送、未归档，待评审。

## 2026-10-28 提交与结案计划

用户已授权提交本轮代码并完成任务记录，未授权推送。此前各轮“未提交/待评审”为当轮历史事实。
本轮仅处理 TASK-0038～0040，不结案其他旧任务。

1. [x] 审阅实际差异和新增文件，重跑最终工作树完整 verify。
2. [ ] 按功能分别提交，保留共享语言包和任务索引中的其他任务改动。
3. [ ] 提交产生后登记真实实现 SHA，修复归档链接并更新变更日志。
4. [ ] 标记完成、归档至 `archive/2026/10/`，提交结案文档并核对最终 Git 状态。

提交前验证：`go -C desktop tool wails3 task verify` 退出码 0，
最终累积工作树的 28 文件 / 284 项前端测试、Go 检查与测试及 Windows 构建全部通过；
`git diff --check`、UTF-8/BOM、JSON 解析与常见密钥格式检查通过。
这是本地验证，不代表 CI 或真实邮箱端到端通过。

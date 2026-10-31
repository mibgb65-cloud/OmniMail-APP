# 功能图标

> 状态：已生效 | 负责人：@Codex | 最后更新：2026-10-27
> 相关：[设计系统](../design-system.md#5-图标) · [TASK-0018](../../07-tasks/active/TASK-0018-morphicons-and-folder-animation.md)

## 用途与边界

功能图标统一使用 `morphicons/react` 渲染，由 `frontend/src/components/UiIcon/UiIcon.tsx` 提供入口；
描边图形数据静态按需引用 `lucide`，六个邮件分类的实心图形使用本地 Heroicons solid SVG，
同一实例的图标变化支持形状过渡。静态图标不会自行播放动画。
侧栏、语言菜单、设置面板、消息卡片、主题与窗口操作复用同一组件，不维护手写路径字典。

软件蓝色标识仍由 BrandMark、原始 SVG/PNG 和 Windows ICO 承担，不以通用 Mail 图标替代，
也不因接入图标库改变品牌透明性、原生任务栏图标或业务能力。

## 依赖评估

- 固定版本：`morphicons` 2.0.2、`lucide` 1.61.0，package.json 与 package-lock.json 同时锁定。
- Morphicons 的 React peer 要求 ≥18，满足当前 React 18.3.1；两包均未声明运行时依赖。
- Morphicons 采用 MIT 许可；Lucide 为 ISC，附带部分 Feather 来源图标的 MIT 声明。
  完整原文分别保留在 [Morphicons 许可](../../../frontend/public/third-party-licenses/morphicons.txt)、
  [Lucide 许可](../../../frontend/public/third-party-licenses/lucide.txt)；Vite public 随构建复制并嵌入 Wails。
- 许可文件与已安装包原文的 SHA-256 一致；历史 `lucide-react.txt` 保留，不能因迁移删除用户既有文件。
- 增量体积、安全审计与实际验证见任务记录；更新版本时重新核对许可和依赖。
- 邮件分类的实心资源来自 Heroicons v2.2.0（24px solid，MIT），只保存六个 SVG，
  不安装图标包；[来源与对应关系](../../../frontend/src/components/UiIcon/filled/README.md)、
  [Heroicons 许可](../../../frontend/public/third-party-licenses/heroicons.txt)随项目保留。

## Props 与统一视觉

| 属性 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| name | UiIconName | 必填 | 只允许组件静态映射中已注册的业务语义名称 |
| className | string | 无 | 复用所在组件的尺寸和布局类 |
| size | number | 18 | 常规 18px；空态等场景可显式或通过既有 CSS 增大 |
| selected | boolean | 无 | 可选；六个邮件分类在 outline/fill 间切换，其他状态按钮在同形紧凑与标准形态间过渡 |

- 视框 24×24，描边固定为 1.6；颜色使用 currentColor，由父元素和主题令牌控制。
- `reducedMotion="user"` 跟随系统减少动态效果偏好；图标变形仅在同一实例的图形数据改变时发生。
- 分类按钮、设置分类、语言与消息入口通过 `selected` 表达状态；设置主题开关使用太阳/月亮变形，语言菜单箭头使用上下箭头变形。
- 保留每个图标原有语义，不将选中的收件箱、星标等图标替换为无关的通用勾号；邮件分类选中时实心、取消选中时描边，Morphicons 在同一 SVG 上执行双向变形。
- 不在业务组件中单独修改笔画粗细、复制 SVG 路径或追加新的图标包。
- 统一 SVG 仅作装饰，设置 aria-hidden=true、focusable=false；按钮本身必须有翻译后的名称，
  非按钮场景则通过相邻可读文本表达含义，不能只依赖图形或颜色。
- 尺寸增大不意味着点击区域自动变大，点击区域仍由按钮和控件布局负责。

## 已实现映射

| 语义 | Lucide 图标 |
| --- | --- |
| compose / workspace / inbox / accounts | SquarePen / LayoutDashboard / Inbox / UsersRound |
| starred / sent / drafts / archive / deleted | Star / Send / FileText / Archive / Trash2 |
| mailOpen / sparkles / panelRightClose / panelRightOpen | MailOpen / Sparkles / PanelRightClose / PanelRightOpen |
| settings / replay | Settings / RotateCcw |
| sun / moon / language | Sun / Moon / Languages |
| chevronDown / chevronUp | ChevronDown / ChevronUp（语言文字选择器折叠及展开箭头） |
| minimize / maximize / restore / close | Minus / Square / Copy / X |
| bell / check / general / about | Bell / Check / SlidersHorizontal / Info |
| search / sync / markAllRead / previous / next | Search / RefreshCw / MailCheck / ChevronLeft / ChevronRight（邮件工具条） |

新增图标时先核对当前包的真实导出，再添加一项静态导入、语义映射及组件测试。
不要因为未来页面清单提到某图标，就提前导入尚未使用的图标。

## 禁止方式与验证

- 不使用 `import * as icons`、完整图标注册表或按任意名称加载的动态图标组件。
- 不请求远程图标 API、CDN 或 webfont；功能图标必须可离线使用。
- 不把图标组件当成可聚焦按钮，不删除现有 aria-label、aria-checked 或键盘处理。
- 运行统一 verify；检查亮暗模式、菜单选择、设置/消息卡片及不同尺寸图标。
  更新依赖后比较实际构建体积并保留许可声明，不仅检查 npm 安装成功。

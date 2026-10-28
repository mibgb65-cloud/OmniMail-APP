# 多语言开发约定

> 状态：已生效 | 最后更新：2026-10-28
> 相关：[前端文件组织](../02-architecture/frontend/file-organization.md) · [代码规范](../00-guidelines/coding-standards.md) · [ADR-0006](../02-architecture/adr/ADR-0006-i18n-framework.md)

桌面端首期支持简体中文（`zh-CN`）和英语（`en`），包括导航、工作台、连接状态、设置悬浮窗、消息卡片、无障碍标签及页面描述。

## 1. 方案与边界

- 使用 `i18next` 管理语言、翻译查找、插值、复数与回退，`react-i18next` 负责 React 订阅和重渲染。组件继续通过类型安全的 `useTranslation(namespace)` 薄适配层读取文案。
- 每个 `I18nProvider` 创建一个独立实例，经官方 `I18nextProvider` 显式注入；不注册全局默认实例。应用 Context 只提供派生的 `locale` 和受白名单保护的 `setLocale`，不维护第二份语言状态或翻译查找逻辑。
- 语言包按“语言 / 页面或功能命名空间”拆成独立 JSON，禁止把后续页面全部追加到一个全局语言文件。
- 语言包在构建时静态导入，通过 `initAsync: false` 同步初始化，支持离线首屏；不引入网络加载器或语言检测插件。文件拆分不等于网络懒加载，后续按真实路由边界评估分包。
- 默认命名空间为 `common`，`fallbackLng` 为 `zh-CN`。缺失键、缺失命名空间或空翻译回退中文；若两种语言都缺失，框架返回键，语言包测试应在交付前拦截这种情况。

## 2. 目录与职责

```text
frontend/src/
├── locales/
│   ├── zh-CN/
│   │   ├── common.json       # 跨页面公共文案
│   │   ├── navigation.json   # 应用导航与外壳
│   │   ├── workspace.json    # 初始化工作台
│   │   ├── connection.json   # 桌面服务连接面板
│   │   ├── settings.json     # 设置悬浮窗
│   │   └── messages.json     # 消息入口与空态
│   └── en/                  # 同名、同键的英语文件
├── lib/i18n/
│   ├── resources.ts         # 显式注册语言包与结构类型
│   ├── i18next.d.ts         # 原生命名空间和翻译键类型扩展
│   ├── instance.ts          # 独立实例、离线初始化与回退策略
│   ├── locale.ts            # 语言白名单、系统检测、偏好读写
│   ├── context.ts           # 派生语言与切换入口
│   ├── I18nProvider.tsx     # 官方 Provider 装配、文档语言和描述同步
│   └── useTranslation.ts    # 原生翻译 Hook 与语言控制的薄适配
└── components/LanguageSwitcher/
    ├── LanguageSwitcher.tsx        # 顶部/设置共用的横向展开胶囊，可带可见标签
    └── LanguageSwitcher.module.css # hover / focus-within、选中态与主题 Token
```

`common` 只收录真正跨页面复用的文案。页面标题、空状态、错误提示和按钮说明属于对应页面或功能，不放进 `common`。

## 3. 组件如何使用

例如，在 `src/app/` 下的组件中：

```tsx
import { useTranslation } from '../lib/i18n/useTranslation';

export function WorkspaceTitle() {
  const { t } = useTranslation('workspace');
  return <h1>{t('title')}</h1>;
}
```

- 命名空间和键由 i18next 原生类型检查，不使用中文句子作为键；开启 `strictKeyChecks`，即使传入 `defaultValue` 也不能绕过键检查。
- 一条完整语句对应一条翻译，不拼接多个片段凑句子，避免英语语序错误。
- 可见文本、`aria-label`、`title`、占位符等一起翻译；品牌名、技术标识、版本号、提交号等原始数据不翻译。
- 当前构建时间保持后端原始 ISO 值；今后展示日期、数字时使用 `Intl.DateTimeFormat`、`Intl.NumberFormat` 并传入当前 `locale`。
- 语言包只含纯文本，通过 React 文本节点渲染，禁止用 `dangerouslySetInnerHTML` 解释翻译内容。
- 底层 Go / IPC 错误仍是诊断信息，不直接显示。界面按状态选择所属命名空间的安全提示。

### 3.1 插值与复数

动态文本使用 `t('key', { name })`，语言包用 `{{name}}` 占位；不要拼接句子。`interpolation.escapeValue` 为 `false`，由 React 文本节点统一转义，避免重复转义；这不意味着允许将结果写入 HTML。

新增复数文案时使用 i18next 的 JSON v4 后缀，类别由 `Intl.PluralRules(locale)` 决定。例如未来 `inbox` 命名空间的中文资源：

```json
{ "messageCount_other": "{{count}} 封邮件" }
```

对应英语资源：

```json
{
  "messageCount_one": "{{count}} message",
  "messageCount_other": "{{count}} messages"
}
```

注册该命名空间后，使用 `useTranslation('inbox')` 返回的 `t('messageCount', { count })`，不要自行判断单复数。测试按逻辑键及各语言必要的复数类别校验，中文无需补造 `_one`。当前生产语言包尚无邮件数量文案，上例不代表收件箱已实现。

## 4. 新增页面或语言

新增页面，例如 `inbox`：

1. 同时创建 `locales/zh-CN/inbox.json` 与 `locales/en/inbox.json`，保持逻辑文案键一致，复数变体遵循各语言规则。
2. 在 `lib/i18n/resources.ts` 导入并注册两份资源，中文结构作为类型基准。
3. 页面使用 `useTranslation('inbox')`，不把收件箱文案放进 `workspace.json`。
4. 运行语言包测试及前端检查。测试会发现漏注册的文件、缺失命名空间、缺键、多键、空翻译及缺少必要复数变体。

新增语言时，为现有每个命名空间提供同名文件，在 `resources.ts` 注册，并更新 `SUPPORTED_LOCALES`、`detectLocale` 及切换选项。`isLocale` 自动复用 `SUPPORTED_LOCALES` 白名单。不得直接用存储值拼接文件路径或动态导入地址。

## 5. 语言选择与存储

- 优先级：已保存的有效手动偏好 → 系统语言列表中第一个支持的语言 → 简体中文。
- 系统语言的 `en-US`、`en-GB` 等映射到 `en`，`zh-CN`、`zh-Hans-SG` 等映射到 `zh-CN`。首期仅提供简体中文，不提供繁体中文翻译。
- 首次检测不会写入偏好；用户通过右上角或设置面板中的语言胶囊手动切换后，保存到当前 WebView 来源的 `localStorage`，键为 `omnimail.locale`。两种入口共用 LanguageSwitcher 和 I18nProvider，不维护额外语言状态。
- 胶囊收起时显示翻译图标与当前语言简写（简中 / EN）；hover 或 focus-within 时横向展开全部支持的语言。按钮以完整语言名提供 `aria-label` / `title`，用 `aria-pressed` 表达当前语言。收起的非选中项不可见且不参与焦点导航，聚焦当前项后其他选项可达。
- Tab / Shift+Tab 正常进出组件，方向键和 Home/End 只移动焦点，Enter / Space / 点击调用原有 setLocale；展开或浏览本身不保存偏好。组件没有菜单/Popover，不截获 Esc，也不增加外部关闭或定位监听。
- 语言简写放在 common 语言包中；选项由 SUPPORTED_LOCALES 映射，切换时保留按钮 DOM 顺序。颜色仅引用现有主题 Token，展开过渡遵守全局减少动态效果偏好。
- 选中高亮是 `aria-hidden` 的单个装饰层，按当前 locale 的选项索引通过 transform 滑动；语言槽位统一 44px，避免测量和切换时宽度抖动。460ms 的回弹贝塞尔曲线只作用于视觉位移，不延迟 setLocale，也不新增定时器、动画状态或监听；减少动态效果时即时定位。
- 切换立即更新组件、`document.documentElement.lang` 和页面描述，不重挂载工作区、不重新请求 Go 服务。
- 非法或过期存储值被忽略。存储读写被禁止或额度耗尽时，应用仍可启动和切换；该会话的手动选择不保证能在重启后恢复。
- 开发与正式应用可能使用不同 WebView 来源，偏好不保证跨来源共享；本期不修改 Go 配置、数据文件格式或绑定协议。

## 6. 验证

在 `desktop/frontend/` 执行：

```powershell
npm test -- src/lib/i18n src/app/App.test.tsx
npm run check
npm run build
```

桌面检查时，通过 `go tool wails3 task dev` 启动，在右上角切换中英文，确认导航、页面标题、连接状态及按钮同时更新；重开同一来源后确认偏好恢复。浏览器预览仅用于前端检查，不代表 React 与 Go 的连接成功。

## 7. 依赖评估

2026-10-24 经用户确认引入以下固定版本，来源为 npm 元数据与安装包，核对日期同日：

| 依赖 | 版本 | 许可证 | npm 解包大小 | 元数据最近修改日期 |
| --- | --- | --- | --- | --- |
| [i18next](https://www.npmjs.com/package/i18next) | 26.5.10 | MIT | 543,971 B | 2026-10-24 |
| [react-i18next](https://www.npmjs.com/package/react-i18next) | 17.1.7 | MIT | 978,587 B | 2026-10-24 |

- 两项依赖仍在发布维护；当前 `react-i18next` 的 peer 约束为 React ≥ 16.8、i18next ≥ 26.2、TypeScript 5/6/7，与现有 React 18、TypeScript 5.9 兼容。版本固定在 `package.json` 和 `package-lock.json`，更新时重新执行类型检查与回归测试。
- npm 解包大小包含多种发行格式和类型文件，不等于客户端增量。相同工程、相同构建命令下，生产 JS 从 176.77 kB / gzip 58.30 kB 增至 227.34 kB / gzip 74.81 kB，增量约 50.57 kB / gzip 16.51 kB；CSS 未变。这不是原生安装包体积或启动性能测量。
- 安装审计及 `npm audit --omit=dev` 均报告 0 个已知漏洞；不代表未来依赖风险为零。

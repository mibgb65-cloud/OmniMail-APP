# TASK-0062 NAVER、Yandex 与 iCloud 邮箱预设

> 2026-11-01 收尾：用户已接受本批交付并授权本地提交，未授权推送；联合验证和归档由 TASK-0072 登记。下方未授权文字保留当轮历史含义。

> 状态：待评审
> 负责人：@Codex | 创建：2026-10-31 | 优先级：P1

## 需求与范围
- 用户明确要求将 NAVER Mail、Yandex Mail、iCloud Mail 接入为可选预设服务商。
- 包含：官方 IMAP/SMTP 参数、服务商选择、精确域名识别、单个/同服务商批量添加、授权说明与测试、相关文档。
- 不包含：大邮件限额调整（上一轮待用户确认）、OAuth 新集成、新依赖、数据库迁移、提交与推送。

## 初始状态与分析
- 工作树已有 TASK-0061 的未提交 UI/计数改动，全部保留；本轮仅修改新服务商相关范围。语言包和 active 索引将与上轮共用文件，交付时说明。
- 当前预设集中在 `domain.ProviderPresets`；前端单个/批量共用预设及输入解析。
- 先核验三家官方端点、TLS 模式、应用专用密码及用户名要求，不能将网站登录密码或 OAuth 占位当成已支持认证。
- 方案优先扩展现有预设和授权指引，不另建发现服务，不联网猜测未知域名。
- 官方依据（核验于 2026-10-31）：
  - NAVER：[客户端配置](https://help.naver.com/service/30029/contents/21349?osType=PC)、[连接设置](https://help.naver.com/service/30029/contents/21351?osType=COMMONOS)：`imap.naver.com:993` 隐式 TLS，`smtp.naver.com:587` STARTTLS；先启用 IMAP/SMTP，使用完整邮箱和应用密码。
  - Yandex：[其他客户端](https://yandex.com/support/yandex-360/customers/mail/en/mail-clients/others)、[故障排查](https://yandex.com/support/yandex-360/customers/mail/en/mail-clients/mail-clients-troubleshooting)：默认 `imap.yandex.com:993` / `smtp.yandex.com:465` 隐式 TLS；启用 IMAP 与应用密码访问，使用邮件应用密码。官网另列境外 IMAP `imap.ya.ru`，本轮不做地理推断或失败后静默换主机，必要时走现有自定义入口。
  - iCloud：[服务器参数](https://support.apple.com/en-us/102525)、[历史邮箱域名](https://support.apple.com/en-la/118230)：`imap.mail.me.com:993` 隐式 TLS，`smtp.mail.me.com:587` STARTTLS。官方允许完整邮箱作为 IMAP 用户名、SMTP 要求完整邮箱，因此复用现有完整邮箱凭据模型；要求应用专用密码，不收集 Apple 账户登录密码。
- 精确识别 `naver.com`、`yandex.com` / `yandex.ru` / `ya.ru`、`icloud.com` / `me.com` / `mac.com`。其他地区别名及自定义域名可手选预设或自定义，不泛匹配子域名。
- 默认值只影响新账号，不改已有持久化端点；扩展单一预设工厂以明确 SMTP 端口/TLS，不新增接口字段、迁移或依赖。
- Yandex 按官网个人域使用 @ 前用户名，企业/其他手选域使用完整地址；单个/批量共用 `resolveProviderInput`，保留用户原邮箱大小写和应用密码，不扩展 Gmail 专有密码归一化规则。
- NAVER、Yandex、iCloud 的图标均已从官网 favicon 成功获取并验证原始 ICO，来源和 SHA-256 记录在 `frontend/public/providers/README.md`，不重绘、不运行时请求第三方。

## 分步计划（单步不超过 10 文件/600 行）
1. [x] 核验官方配置、现有输入与验证规则，补齐取舍和验收范围。
2. [x] 先补预设/域名/输入回归，再扩展后端预设和必要的安全校验。
3. [x] 接入选择入口、品牌资源/安全降级、中英文说明及单个/批量流程测试。
4. [x] 更新相关文档，运行定向及完整 verify，审阅差异并回填交付记录。

## 验收标准
- [x] 三家预设可选，正确填充官方 IMAP/SMTP/TLS 参数；不改写已有账号。
- [x] 已核验的邮箱后缀精确识别，拒绝伪造/未知后缀的误匹配。
- [x] 预设使用正确用户名与独立应用密码，单个和批量输入一致；不泄露秘密。
- [x] 授权前提清晰，不误称已验证真实服务商的收发。
- [x] 完整 verify 通过，记录真实账号/平台未验证项，无无关改动与自动 Git 操作。

## 实现与验证
- 三个后端预设、精确后缀识别、官方本地图标及中英文授权提示已接入；没有新建 OAuth/发现接口。
- Yandex 的个人域与企业域用户名通过单个/批量共用解析处理；iCloud 使用官方允许的完整邮箱 IMAP 用户名与要求的完整邮箱 SMTP 用户名。
- 安全日志的服务商白名单加入三个固定 code，继续不输出账号、口令、服务器响应原文或邮件内容。
- 已补充预设/识别、用户名、单个/批量、英语说明、凭据持久化、日志白名单和未知 code 的安全提示匹配测试；使用 Map 避免原型属性被误当成翻译键。
- 未修改依赖、数据库迁移、大小限额或协议实现；本轮生成绑定未引入新字段，工作树中 `messageCount` 字段仍属于 TASK-0061。

| 日期 | 实际命令/核对 | 结果 |
| --- | --- | --- |
| 2026-10-31 | `go -C desktop test ./internal/domain -run TestInternationalProviderPresets`（实现前） | 三个子测试因缺少预设失败 |
| 2026-10-31 | `npm test -- src/components/MailDialogs/providerDetection.test.ts`（实现前/后） | 实现前 7 个新域名失败；实现后 42/42 通过 |
| 2026-10-31 | `go -C desktop test ./internal/domain -run 'TestInternationalProviderPresets\|TestProviderPresets'` | 通过 |
| 2026-10-31 | `npm test -- src/components/MailDialogs/InternationalPresets.test.tsx src/components/MailDialogs/providerInput.test.ts`（实现前/后） | 实现前 14 失败；实现后 21/21 通过；修正测试的批量折叠字段定位后通过 |
| 2026-10-31 | `go -C desktop test ./internal/service -run 'TestInternationalAccounts\|TestSyncSelectDiagnostic'`（日志扩展前） | 新增账号持久化通过；三个日志白名单测试失败，已据此扩展固定白名单 |
| 2026-10-31 | `npm test -- src/components/MailDialogs src/lib/i18n` | 20 文件 217 测试通过（新增安全匹配测试前的阶段结果） |
| 2026-10-31 | `go -C desktop test ./internal/domain ./internal/service ./internal/repository ./internal/bridge` | 全部通过，包括新预设、日志白名单、凭据与端点持久化 |
| 2026-10-31 | `node desktop/.task/t62-browser-check.mjs` | Chromium 模拟数据检查通过：三个官方图标正常加载、卡片选择、域名识别、中性主题卡片的亮暗模式与 600px 窄窗口；无 pageerror |
| 2026-10-31 | `go -C desktop tool wails3 task verify`（最终代码） | 完整通过：Go/前端格式、Go vet、ESLint、类型检查、全部 Go 测试、前端 66 文件 610 测试、绑定生成、前端生产构建与 Windows 可执行文件构建；日志 `desktop/.task/t62-verify-final.log` |
| 2026-10-31 | 图标来源/文件头/哈希、文档本地链接、`git diff --check` | 通过；三个本地图标哈希与资源 README 一致，未提交/推送 |

### 验证产物与说明
- 验证可执行文件：`desktop/.task/verify-bin/OmniMail.exe`，不覆盖正在使用的 `desktop/bin/OmniMail.exe`。
- 模拟数据预览脚本位于忽略的 `desktop/.task/t62-*`；只检查组件与预设，不向原生或远端提交凭据。
- 截图：`C:/Users/mimanchi/.codex/visualizations/2026/10/31/01a1910b-39fa-7021-ab01-8379dfaa9c46/t62-providers-{light,dark,small}.png`。
- 文档更新：当前向导、账号接入功能当前实现、schema 服务商扩展说明、变更日志、品牌来源及 active 索引。

## Git 与交付
- 提交/推送：均未授权，未提交、未推送。
- 既有改动：保留 TASK-0061 全部未提交文件；大邮件方案未实施。
- 交付状态：实现及验证已完成，未提交，待用户评审。
- 遗留风险：未使用三家真实账号验证 IMAP/SMTP 登录、发送或首次完整同步；账号授权、服务商地区限制、iCloud 主邮箱/别名资格及 macOS WebView 需用户本机确认。浏览器模拟与本地测试不等于真实收发验收。本轮不读取用户凭据/正文，不新增依赖或迁移。
- 归档日期：未归档，保留 active。

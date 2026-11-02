# TASK-0083 GitHub 发布、安装与更新链路设计

> 状态：进行中（Windows 当前用户安装与发布实现）
> 负责人：@Codex | 创建：2026-11-01 | 优先级：P1

## 用户需求
- GitHub 推送 tag 自动触发 Actions，构建带 OmniMail 自签名的安装包。
- 首次安装选择语言、程序和完整数据位置，桌面快捷方式默认开启、自动启动默认关闭。
- 更新设置包含启动后定期检查、发现新版本自动下载并校验；开发运行不自动下载。
- 显示当前版本更新日志，消息模块展示更新状态与“重启并更新”，用户点击后静默升级。
- 通用设置提供 Windows 开机自动启动开关。

## 本轮范围
本轮先设计并保存完整链路，区分事实、提案与待确认项；不把占位界面说成已接入。
不创建证书或私钥、不配置 GitHub Secrets、不打 tag/推送或触发远端发布，不变更运行代码。
实现跨越发布工具、安装器、系统启动与可执行更新，需要方案确认后按子步骤实施。

## 已核对事实
- 当前远端：`https://github.com/mibgb65-cloud/OmniMail-APP.git`；本轮未验证仓库/Release 的公开可读性。
- 当前为 Wails v3，Taskfile 能 verify/build 独立程序；没有实际安装器、签名或 tag 发布 workflow。
- `bridge.Version` 默认 `0.1.0-dev`，资源版本静态；现有发布文档仍有标注历史的 Wails v2 内容，不能直接套用。
- MessagesPopover 为空态，SettingsUpdates 仅显示版本与未接入说明。
- Go 数据由 Config.DataDir 控制，但没有显式设置 Windows.WebviewUserDataPath；
  前端语言/主题/阅读偏好仍存 WebView localStorage，不能仅改 SQLite 目录就宣称“所有数据迁移”。
- 已有系统凭据存储与关闭/托盘逻辑；更新退出必须绕过“关闭留后台”，但先保护未完成的发送/编辑。

## 计划与验收
1. [x] 文档化安装、数据位置、自启、签名、版本协议、下载/重启更新与通知共享状态。
2. [x] 标注用户已确定内容、建议默认值和实施前待确认项。
3. [x] 人工核对本地事实、链接与文档示例；交付设计评审，不执行尚未确认的发布流程。

## 实现与验证
- 新增 `desktop/docs/06-release/update-system-design.md`，明确为待确认提案：
  Windows 当前用户安装建议、语言/完整数据目录、WebView profile、OS 凭据例外、
  GitHub tag 流水线、Authenticode 与可信清单签名、更新状态机、当前日志、消息卡、
  受保护的重启安装、自启及分期验收。
- 在当前构建说明添加提案入口，保留“安装/签名/发布尚未实现”的实际基线。
- 提案区分安装后立即运行与登录 Windows 自启、自动下载与用户触发静默安装，
  不擅自采用未确认默认策略；未承诺自签名消除系统安全警告或强行绕过权限。
- 未实施运行代码，没有连接 GitHub、配置 Secrets、创建证书/私钥、下载/执行更新包或注册自启。

## 验证记录（2026-11-01）
| 核对 | 实际结果 |
| --- | --- |
| 本地代码/构建/远端核对 | 确认实际远端、版本注入现状、无安装器/发布 workflow、消息/更新占位及未设置 WebView 数据路径；未验证 GitHub 公共可访问性 |
| `git diff --check` | 通过 |
| 提案/记录相对链接与 4 文件 UTF-8 无 BOM 检查 | 通过 |

本轮纯设计文档，没有新增可执行命令或配置，不运行 Go/前端测试及 verify。
设计方案未获得真实 GitHub Release、Windows 安装器或端到端升级验证，不能据此宣称功能通过。

## Git 与交付
- 未授权提交、推送或远端发布；未提交，未归档。
- 所有 TASK-0073～0082 和其他用户修改保留。
- 本任务完成条件是设计评审，不等于软件更新能力实现或 GitHub 流水线已通过。
- 交付：待评审。确认建议平台/工具、开关默认值、仅 C 盘政策及签名材料配置后再拆实施任务。

## 第二轮授权与执行（2026-11-01）
- 用户明确要求先完成 TASK-0085，再实施 Windows x64＋当前用户安装＋Inno Setup；前者已收尾。
- 本轮开始真实代码：安装数据定位与 WebView profile、首次语言、自启、Inno 安装包、
  tag 发布/签名脚本，以及更新服务/设置/消息与安全重启链路。
- 默认按提案建议：自动检查开启、自动下载关闭、桌面快捷方式开启、安装后立即运行及登录自启关闭。
  C 盘不静默推荐；用户显式选择时告警二次确认，非本机可写/程序数据互含目录拒绝。
- 签名 Secret/公钥未提供：代码可编译验证，但正式发布必须因缺失密钥失败；
  仅显式开发打包允许 unsigned，不生成/上传私钥、不推送/tag/发布。
- 拆步骤，每步最多 10 文件/600 行：系统定位/启动 → 版本/安装器/CI → 安全更新后端 →
  UI/消息 → 本地打包/接口安全测试/完整 verify。真实 GitHub 和正式签名结果按实际材料报告。

## 第三轮接续核查与实施计划（2026-11-01）
- 用户要求按顺序继续并报告进度；先复验 TASK-0085，再推进 Windows x64、当前用户安装、
  Inno Setup 与签名发布链路。已发现的安装器、脚本、workflow、平台定位和 updater 文件仅是未验证初稿，
  不能视作完整发布能力，也不能把先前“本轮先设计”的状态当作当前实现状态。
- 本轮以可验证的安装发布闭环为边界，不扩张到尚未接好前端的应用内自动更新页面。
  现有更新后端/助手若影响编译、签名清单或安全安装则纳入审阅和必要测试；未闭环部分明确记录。
- 分步实施（每步不超过 10 文件/600 行）：① 翻译回归；② 安装数据路径/平台适配与测试；
  ③ 发布版本、签名清单与测试及工具门禁覆盖 cmd；④ Inno/PowerShell/workflow 安全修正；
  ⑤ 开发包编译与隔离安装/升级/卸载验证；⑥ 文档、完整 verify 与差异审阅。
- 不生成正式私钥/证书、不配置 Secrets、不打 tag、不推送、不实际发布。
  正式包缺少证书、清单私钥或匹配公钥必须失败；只有显式开发参数可生成醒目标识的未签名测试包。
- 验收：x64/非管理员安装、程序数据目录隔离、数据盘失效不静默回退、升级保留数据、卸载不删除用户数据；
  锁定版本与产物名单，签名/校验失败不进入 GitHub Release 发布步骤。

## 第三轮实现结果（2026-11-01）
- TASK-0085 的既有翻译实现已重新回归；未重复上传邮件、未扩大翻译行为。
- `platform/installation*`、`config.Load` 与应用装配：只从匹配本程序位置的 HKCU 安装记录定位数据；
  开发环境覆盖保持优先，缺失目录不静默回退；注册表路径拒绝 ADS、穿越、控制字符、
  无效 UTF-8、网络/根目录与程序数据互含，安装数据逐层拒绝重解析目录。
  WebView profile 显式放入所选数据目录，系统凭据仍保留系统凭据库。
- 安装语言只读桥接与 i18n：无手动语言偏好才采用安装语言，既有设置、本次手动选择和
  显式测试 initialLocale 优先，取消/迟到结果不能覆盖用户选择。
- `installer.iss`：锁定 Inno 6.7.0、x64、当前用户不提权；简体中文/英文、独立程序/数据目录、
  默认桌面快捷方式、不默认立即运行/登录自启；静默升级保留原位置/语言，拒绝降级、
  失效数据位置和升级迁移程序位置；卸载保留数据。
- 从固定上游 blob 引入简体中文语言文件，保留译者说明并转换 UTF-8 无 BOM。
- `package-windows.ps1`：明确开发模式才允许 unsigned；正式材料缺失立即失败，
  Windows 版本分段限 0..65535，版本资源与主程序一致。每次独立产物目录，不混用旧资产。
  开发包名含 dev-unsigned，独立 AppId/HKCU/快捷方式，避免覆盖正式安装。
- `sign-windows.ps1`：检查 CN/EKU/有效期/私钥，限制单证书 PFX 和材料长度；
  PFX 使用当前身份 ACL，密码不进入 signtool 命令行，签名/时间戳/指纹/信任链必须通过。
  仅隔离 GitHub runner 临时信任公开自签证书，清理失败也停止发布，不向安装用户注入根证书。
- `cmd/release-manifest`：受限读取/流式哈希、版本/文件名/密钥预检、Ed25519 签名并回验，
  不把密钥或原始错误写日志。`Taskfile.yml` 将 cmd 一并纳入格式、vet 和测试门禁。
- workflow：main 历史与固定仓库校验，已有 Release/draft 或 GitHub 检查异常均拒绝；
  固定编译器版本及下载 SHA-256，完整 verify、开发安装冒烟，再构建签名正式资产；
  要求独立版本说明，按五文件白名单上传 draft，成功后公开，不覆盖已有版本。
- 发现应用内更新的草稿/发送保护和设置/消息尚未闭环，因此撤下初稿中的自动更新装配：
  不创建运行期 Manager、不注册 UpdatesBridge、不启动后台更新、不在固定延时后强制退出。
  updater/助手仅保留预备代码和签名契约，不把它们描述成已启用的更新功能。

## 第三轮验证及开发阶段拦截
| 核对/命令 | 实际结果 |
| --- | --- |
| 翻译关键回归 | Go 适配/服务/存储匹配用例通过，前端 4 文件 / 22 项；详见 TASK-0085 |
| 安装路径失败测试 → 修复 | 初稿接受 ADS、穿越、无效 UTF-8、尾随点/空格，5 个边界先失败；修复后通过 |
| `go test ./cmd/... ./internal/updater ./internal/platform ./internal/config ./internal/app -count=1` | 通过；清单签名/篡改/错误仓库/平台/大小/路径与版本、平台定位和配置回归 |
| 首次安装语言及桥接回归 | 已纳入完整前端测试；覆盖白名单、错误降级、手动偏好和迟到结果 |
| `go -C desktop tool wails3 task verify` | 完整通过，含 cmd；前端 91 文件 / 786 项，Windows 独立构建成功；日志 `.task/t83-verify-final.log` |
| `test-release-windows.ps1` | 通过：4 项缺失材料逐项拒绝、签名材料/编译器缺失拒绝、脚本语法 |
| 正式 Inno 默认编译（不提供签名工具） | 预期失败，未生成正式安装包；日志 `.task/t83-signed-rejection.log` |
| workflow 本地校验 | PyYAML 解析、tag/step 结构与 7 段 PowerShell AST 语法通过；未调用 GitHub Actions |
| Inno 实际开发编译与隔离安装 | 真实 Windows 测试通过；日志 `.task/t83-installer-smoke-final.log` |
| `git diff --check`、新增配置/脚本/文档 UTF-8 无 BOM | 通过 |

最终完整开发打包命令（仓库根目录）：

```powershell
./desktop/scripts/package-windows.ps1 -Version 0.1.0 -NotesFile desktop/docs/08-history/changelog.md -AllowUnsignedDevelopment
```

- 命令最终成功，日志 `.task/t83-package-final.log`；使用 Inno 6.7.0 的明确 `x64os`，
  不使用已弃用的 x64 别名或允许 ARM64 兼容执行的 x64compatible。
- 测试包：`.task/release/0.1.0-development-2ce8bea728114dbd98e702f52ec91ecf/OmniMail-0.1.0-dev-unsigned-windows-amd64-setup.exe`，
  9,240,804 字节；SHA256SUMS 回验一致、Authenticode 状态 NotSigned，与醒目开发标识一致，不能正式发布。
- 该包再次执行 `test-installer-windows.ps1` 全部通过，包括默认桌面快捷方式、
  主程序/助手的 AMD64 PE 校验、相对/互含路径、数据位置失效和最大主版本降级拒绝。
  原生日志确认 `User privileges: None`、`Administrative install mode: No`、`64-bit install mode: Yes`。
- 本轮最后实例已卸载，独立 HKCU 安装记录和测试快捷方式已清除，
  `.task/installer-smoke-f4568318ff1d458e946ddd6a2bb586f6` 的合成数据仍存在。
  没有修改正式安装；Git 已暂存文件数为 0。

开发阶段捕获并修复：
- 编译期纠正 `SetupSilent`、`SplitString` 并非当前 Inno Pascal Script 可用接口，改为实际可编译的实现。
- 输入控件会自动把相对参数转绝对路径：新增真实失败用例后在赋值前检查原始参数。
  第一次失败测试意外创建的隔离开发实例已通过其自己的卸载器移除，未触碰正式实例。
- 静默模式不能复用交互式 NextButtonClick 弹窗，否则互含路径测试会无人值守卡住；
  已中止仅本轮的两个挂起测试安装进程，改由 PrepareToInstall 返回失败码，并增加测试超时。
- 打包 Int64 版本比较的高位边界允许 65535 主版本被降级覆盖；
  保留失败测试，改为有界整数逐段比较后拒绝测试通过，未降低验收边界。
- 一次构建恰逢新语言桥接尚未写入，类型检查按预期拦截；完成桥接后完整门禁通过。
  本地 YAML 核查的一次固定 step 数断言过时，改为检查实际触发/命名步骤和所有脚本，不是 workflow 语法缺陷。

## 剩余工作、限制与 Git
- 实际签名/时间戳/自签链验证、GitHub Release 上传及 Actions 远端运行尚未验证；
  未查询或配置远端 Secrets/Variables，不把缺失材料拒绝测试等同正式签名成功。
- 版本特定说明须在真正发版时编写；没有创建虚构版本公告。
- 应用内更新设置、通知、下载进度、草稿/发送保护、用户确认重启及真实更新端到端仍待后续实施。
  安装原生测试不等于这些功能已完成；当前记录保留进行中。
- 未覆盖 ARM64、macOS/Linux、WebView2 缺失自动安装、旧独立版数据自动迁移，
  未实测正式签名包和已在运行程序被覆盖的交互；自签名不会消除 SmartScreen 警告。
- Vite 主包约 543.53 kB 的建议性警告保留，本轮不扩展到拆包重构。
- 保留所有其他任务的既有修改；未暂存、未提交、未推送、未打 tag、未归档。
  不自动清理 `.task` 诊断产物或用户数据；Windows 安装发布的本地闭环交付评审。

## 第四轮生产打包请求（2026-11-01）
- 用户先要求提交代码并打包 v0.0.1，随后明确要求“不用验证，直接打生产包”；
  本轮遵从最新指示直接调用正式打包入口，不运行测试、完整 verify 或安装冒烟。
- 不把该指示解释为允许绕过生产签名、自动创建私钥/证书、发布到 GitHub 或推送 tag。
  当前进程中四项正式签名材料均未配置；仍实际调用生产入口，记录其真实失败结果，不生成开发替代包。
- 工作树仍混有 TASK-0073～0085 的历史改动；本轮尚未暂存或提交，不以生产包请求为由
  将未审阅的其他任务修改直接混入提交。后续 Git 处置必须记录真实结果。
- 已实际执行 `./desktop/scripts/package-windows.ps1 -Version 0.0.1 -NotesFile desktop/docs/08-history/changelog.md`，
  退出码 1，入口报错：`正式发布缺少 Secret/变量: WINDOWS_SIGN_CERT_PFX_BASE64`。
  在创建打包目录和编译前即停止，未生成 v0.0.1 安装包，没有降级或改名使用旧开发包。
  未运行测试/verify，未暂存、未提交、未推送。

## 第五轮 GitHub 签名配置请求与核查（2026-11-01）
- 用户要求先把签名配置设置到 GitHub，再在本地打包 v0.0.1；这授权配置目标仓库的
  三项 Secrets 与一项公开公钥 Variable，不代表自动授权创建证书、长期改变本机根信任、
  推送 tag 或公开 Release。继续遵从“不跑测试/verify”，保留生产安全门禁。
- 经当前已登录 GitHub CLI 确认目标仓库 `mibgb65-cloud/OmniMail-APP`，当前身份具备 admin 权限。
  首次 Secrets 列表读取因 EOF 失败，随后同一仓库 API 只读重试成功；
  远端仓库级 Secrets 和 Variables 列表均为空，未读取或回显任何凭据内容。
- 当前进程四项环境材料仍未配置；CurrentUser/My 中 CN 为 OmniMail 的证书数量为 0。
  没有可直接上传/用于本地签名的既有材料，也没有上传占位值或修改远端配置。
- GitHub Secrets 不可回读，不能靠“先上传再下载”完成本地打包。
  后续需用户确认安全生成/保管方案：新建代码签名证书及 Ed25519 更新密钥，
  在仓库外按当前用户加密保存同一套材料；远端只写 Secrets/公开公钥 Variable；
  本地签名若需临时信任自签公开证书，必须明确授权、限定打包期且结束清除。
  自签名不能保证消除 SmartScreen/未知发布者提示。
- 截至本轮核查结束未生成证书或密钥、未改 GitHub 配置、未修改本机信任、未打包成功，
  未暂存/提交/推送；等待生成与保管方式确认。

## 第六轮明确授权与执行计划（2026-11-01）
- 用户明确回复“可以，运行”，授权上一轮方案：生成 OmniMail 自签名代码证书和 Ed25519 更新密钥，
  在仓库外按当前 Windows 用户加密保存，配置目标仓库三项 Secrets/一项公钥 Variable，
  本地打包时临时信任公开证书并结束撤销，生成 v0.0.1 生产安装包。
- 不运行测试、完整 verify 或安装冒烟；仅执行生成、加密、GitHub 配置与签名打包必需的安全门禁。
  不推送代码/tag，不创建或公开 GitHub Release，不安装证书到最终用户电脑。
- 分步不超过 10 文件/600 行：① 当前用户 DPAPI 密钥生成器；
  ② 仓库外受限 ACL 材料保管与 GitHub 标准输入上传；
  ③ 显式本地临时信任参数传递及清理；
  ④ v0.0.1 版本说明、正式打包与实际结果记录。
- 使用固定目标仓库，不将密码/私钥放命令参数、Git、日志或聊天。
  不覆盖未知既有签名材料，不轮换已生成的更新信任密钥；上传失败保留成功项和材料，不静默替换重试。
- 本轮开始再次读取仓库级配置，Secrets/Variables 均为空；未据失败请求推断成功，
  后续每项写入分别记录返回结果。已有 TASK-0073～0085 混合修改继续保留。

## 第六轮已执行进度
- 新增 `cmd/release-key`：在 Windows 中生成 Ed25519 更新签名种子并直接按 DPAPI CurrentUser 加密写盘，
  仅输出公开公钥；不覆盖已有文件，明文种子不写盘、不输出。
- 新增 `scripts/release-signing.ps1`，提供生成/复用、GitHub 配置与本地生产打包入口；
  材料位于当前用户 `%LOCALAPPDATA%\OmniMail\release-signing\mibgb65-cloud-OmniMail-APP`，
  ACL 仅授权当前身份。PFX/随机密码与种子分别加密保存，公开元数据/成功项回执单独存放。
- 真实身份生成成功：CN=OmniMail、RSA-3072、SHA-256、代码签名 EKU，三年有效期；
  证书生成不长期导入 Root/My，更新公钥与私钥来自同一次安全随机生成。
- 三项 GitHub Secrets `WINDOWS_SIGN_CERT_PFX_BASE64`、`WINDOWS_SIGN_CERT_PASSWORD`、
  `UPDATE_MANIFEST_PRIVATE_KEY` 及 Variable `UPDATE_PUBLIC_KEY` 的写入命令分别返回成功；
  通过 `gh` 标准输入传值，未将私钥/密码加入命令参数、明文文件、Git 或日志。
  保留本机成功回执，不提供从 GitHub 读取秘密的伪实现。
- 正式签名器/打包器增加显式 `AllowTemporarySelfSignedTrust` 参数，贯穿主程序、助手、
  Inno 卸载器与安装包签名；仅当前用户公开证书临时信任，清理对应私钥和本轮信任。
  不伪造 GITHUB_ACTIONS、不关闭签名/时间戳/证书指纹检查，不回退未签名。
- 已编写本次真实本地构建使用的 `notes/v0.0.1.md`，明确自签名、自动更新未启用与本轮不跑测试等边界。
  已开始 `release-signing.ps1 -Action Package -Version 0.0.1`，结果待实际返回；没有宣称已打包成功。
- 首次正式签名打包实际失败于本机缺少 Windows SDK/signtool，发生在证书导入和临时信任之前。
  继续补齐既定签名链路所需的官方构建工具，不改用未签名包：
  采用 NuGet 官方 Microsoft.Windows.SDK.BuildTools 10.0.26100.3916，
  在仓库外当前用户工具目录安装，固定官方包哈希并核对 NuGet/微软工具签名；
  不安装系统级 SDK、不升级项目 Go/npm 依赖、不修改已上传的签名身份。
- 官方 SDK 包首次 PowerShell 下载遇到 TLS EOF，未把部分内容当成有效包；
  改为对同一固定公开文件进行有界 curl 下载重试，保留 TLS 校验，下载后固定 SHA-512 核对。
  工具包下载和包/微软签名门禁通过后，正式生产打包已继续进入前端和 Windows 编译阶段。
- 用户截图并确认点击 Windows 自签证书信任提示“是”，公开指纹与本轮元数据一致。
  主程序和助手实际签名并取得 DigiCert 时间戳，但后续信任链门禁未通过，尚未生成最终安装包；
  本轮临时 Root/My 条目均已清理，不能把已签两个 exe 当成完整打包成功。
- 继续修复打包范围的信任生命周期：整次本地打包只临时信任一次、统一 finally 撤销，
  避免逐文件删除/重新添加导致信任缓存和重复弹窗问题；签名后使用独立 signtool 进程
  核对全部签名/信任链/时间戳，保留预期指纹检查，不降低为“不受信任也算通过”。
  仍不运行单测、verify 或安装冒烟，不更换证书/更新密钥，也不重写 GitHub 配置。
- 后续诊断发现 .NET 添加返回后，当前用户 Root 的证书项并未实际可见，独立签名工具
  仍报告 UntrustedRoot；未将该状态算作通过。改用 Windows 自带 `certutil -user`
  导入/撤销同一指定指纹的公开证书，保留系统确认，并增加添加后真实可见门禁；
  不写系统级 Root、不自动点击确认、不放宽信任链判定。
- 原生导入命令报告成功，但同一指纹的原生查询、.NET/Cert provider 与注册表中均未发现证书；
  Microsoft Import-Certificate 返回 0x80092004。身份指纹与公开文件一致，执行身份为当前用户、
  中等完整性，没有据此推断为已信任或改写策略/提升权限，也没有更换证书为更高权限 CA。
- 增加最长三分钟等待实际信任可见后继续，实际等待后仍未出现，正式入口退出码 1；
  最终错误为“Windows 在三分钟内未实际接受临时公开证书信任，不继续签名”。
  当前没有 v0.0.1 安装包，Root/My 均无该证书残留；GitHub 四项配置与仓库外加密材料保留。
  未运行测试/verify/安装冒烟，未提交/推送/创建 Release，不用已签的中间 exe 冒充安装包。
- 下一步需要通过用户可见的当前用户证书导入确认实际信任状态，再继续同一身份的生产打包；
  公开 `signer-public.cer` 不含私钥。根因尚未查明，不能把命令成功输出当作 Windows 信任生效。

## 第七轮纠正签名与系统信任的混淆（2026-11-01）
- 用户明确指出其他软件不要求安装证书，并接受 Windows/SmartScreen 警告。
  接受此纠正：自签名生产包不需要把签名证书加入根信任；此前额外导入根证书是错误的打包前提，
  不继续要求用户手工导入，也不归咎于用户确认操作。前述导入/诊断记录保留为实际历史。
- 当前方案改为无 Root/TrustedPublisher 信任修改：保持真实 Authenticode 签名与 DigiCert 时间戳，
  固定预期签名证书指纹，用 Windows WinVerifyTrust 校验文件；仅允许本次自签名身份的
  CERT_E_UNTRUSTEDROOT，拒绝无签名、散列不匹配、其他签名错误、无时间戳或身份不符。
  此例外只用于软件自签包，不用于微软 signtool 工具自身的可信签名核对。
- 移除本地包装器、签名器及 CI 路径中的根证书导入，删除临时信任参数，维持 My 中签名所需
  私钥临时导入与 finally 清理；不换证书、不轮换更新密钥、不覆盖 GitHub 配置。
- 继续按用户要求直接生产打包 v0.0.1，不运行测试/verify/安装冒烟，不发布 Release 或推送 tag。
- 无根证书导入的真实打包已完成主程序/助手签名，Windows 原生验证返回预期的自签根不受信任，
  指纹与时间戳门禁通过且没有导入提示；随后 Inno 正式卸载器签名被旧的“仅 .exe 扩展名”限制阻止。
  Inno 的待签名卸载器实际为 `uninst.e32.tmp` PE 文件；下一步仅为 Inno 两种已知临时文件名
  开放格式入口，并对所有目标检查 MZ/PE 头和可执行标记，不泛化接受任意临时文件。
- Inno 调用默认 Windows PowerShell 5 时继承了 PowerShell 7 的模块路径，安全模块无法加载；
  后续改为显式复用当前 PowerShell 7 的完整可执行路径并正确引用空格路径，
  不关闭模块/签名检查，不改用 unsigned 编译。
- 第七轮正式入口实际退出码 0，已生成 v0.0.1 签名安装包及完整五文件资产，
  主程序/助手、Inno 卸载器和安装包实际签名成功；无需添加任何根证书。
  下一步仅把本轮五项已生成资产复制到 `desktop/bin/releases/v0.0.1/` 固定目录，
  目标已存在则拒绝覆盖；不运行安装程序，不覆盖正在运行的 `desktop/bin/OmniMail.exe`。
- 安装器版本信息未显式填写时本机构建显示 0.0.0.0，尽管主程序和清单为 0.0.1；
  补充安装器固定/文本版本为同一 AppVersion 后重新打包。早期候选五文件已复制到固定目录，
  后续只归档本轮自己创建的候选目录（核对绝对路径在 workspace/bin/releases 内），
  不覆盖未知版本目录或用户正在运行的程序。

## 第七轮最终本地交付（2026-11-01）
- 纠正此前不必要的根信任前提后，`release-signing.ps1 -Action Package -Version 0.0.1`
  实际退出码 0；使用相同证书/更新密钥完成正式签名，无证书导入确认，不安装 Root/TrustedPublisher。
- 最终原始产物：`.task/release/0.0.1-release-0bcb2188c534450c81830a88f7e88644/`，
  日志 `.task/t83-release-0.0.1-final.log`。主程序、助手、Inno 卸载器、安装包的签名与时间戳门禁通过，
  安装器文本版本 0.0.1、固定版本 0.0.1.0，主程序与清单均为 0.0.1。
- 固定交付目录：`desktop/bin/releases/v0.0.1/`，明确五项资产：
  `OmniMail-0.0.1-windows-amd64-setup.exe`、`SHA256SUMS.txt`、`RELEASE_NOTES.txt`、
  `update-windows-amd64.json`、`update-windows-amd64.sig`。
- 安装包 9,254,464 字节，SHA-256：
  `92966df934e557417d9f2c65cfc715cedc1d26b67b53fcd07e77c654216f0315`；
  与 SHA256SUMS/签名清单一致，预期证书指纹与时间戳存在。
- 旧的本轮候选目录仅在核对两端绝对路径均位于 `desktop/bin/releases`、
  文件白名单和原候选散列后，原生 Move-Item 归档到 `v0.0.1-candidate-before-version-resource/`；
  没有递归删除目录，没有覆盖用户其他文件或运行中的桌面程序。
- GitHub 三项 Secret 名称均已存在，公开公钥与本机身份相同；没有再次上传、轮换或回读秘密。
  加密材料继续留在仓库外，最终 CurrentUser Root/My 对应条目均不存在，无临时证书残留。
- Windows 的 UnknownError/UntrustedRoot 或 SmartScreen/未知发布者警告仍可能出现：
  这是自签名缺少公共 CA 信任/信誉，不代表 unsigned，不要求终端用户安装证书。
- 按用户要求未重跑项目测试、完整 verify 或安装冒烟；执行的签名/时间戳/文件校验均为生产打包门禁。
  未启动/安装本包，未执行 GitHub Actions、推送 tag 或创建 Release。
- 源码仍含 TASK-0073～0085 混合修改，未暂存、未提交、未推送；不能把本地工作树构建说成
  当前改动已提交或远端发布。安装包已本地交付，整体 TASK-0083 因应用内更新等未完项保留进行中。

## 第八轮首次生产安装误判修复计划（2026-11-01）
- 用户报告首次打开生产安装器即 Runtime error，明确已有环境是开发版本，需要独立安装生产版本。
  已只读确认本机 `HKCU\Software\OmniMail` 无安装元数据值，只有 `OmniMailDesktop` 子键；
  原 `RegKeyExists` 父键判定将它错误识别为旧生产安装。不是数据盘实际丢失，不让用户删注册表或数据。
- 改为专用安装元数据：生产 `Software\OmniMail\Installation`，
  开发 `Software\OmniMail-Development\Installation`，保留既有 AppId/程序目录/启动项隔离。
  后端读取、开发打包注入、安装器与隔离冒烟脚本同步，不能只修向导后让首次应用启动继续误读。
- 已交付的旧候选没有在本机形成生产安装记录；不将通用开发键自动迁移为生产数据。
  新的生产首次安装重新选择独立数据目录；真实生产安装记录不完整/数据目录不可用时仍明确失败。
- 本轮先补能复现旧实现的命名空间回归，再做定向回归和生产安装器“启动到选择数据位置即退出”
  检查，不运行全量 verify，不实际安装或同步邮箱。原用户“不跑全量验证”保留，缺陷入口做最小充分核对。
- 仍按 v0.0.1 重新签名打包，不生成新证书、不修改 GitHub Secrets、不导入根信任。
  修正版输出到新目录，保留原包以供追溯，不覆盖用户可能正在运行的旧安装器。
- 命名空间回归在旧实现先失败两项，修复后 `go test ./internal/platform ./internal/config ./internal/app -count=1`
  通过。新增随机隔离注册表夹具，覆盖仅运行父键/子键、无生产标记的旧开发值、生产新记录、
  不完整记录、明确旧生产记录及已丢失元数据的生产记录；未写真实 OmniMail/Run/卸载记录。
- 保留只读兼容：旧父键必须有匹配生产/开发 AppId 的卸载记录才读取，不把开发父键当迁移来源。
  本机生产/开发 AppId 卸载标记均不存在，确认属于首次生产安装；原运行键和数据保持原样。
- 首个修复生产包已经实际启动探针通过：隐藏窗口中创建了“选择邮件数据位置”页，
  未出现 Runtime error/原数据丢失提示；仅关闭探针自己启动的进程，未点击安装。
  日志 `.task/startup-probe-5df7520d414b4f2b9e486f6b9a90d865.log`。
  更新本次版本说明后重新生成最终包，并对最终包重复同一入口检查。

## 第八轮修正版交付结果
- 最终生产打包退出码 0，原始输出 `.task/release/0.0.1-release-a2cdbbc8bace470f8d3b088ec552626c/`，
  日志 `.task/t83-release-0.0.1-isolation-fix-final.log`，继续使用同一签名证书和更新密钥。
- 对最终包重复原生启动检查通过：`DataLocationPageCreated=true`、`RuntimeError=false`，
  日志 `.task/startup-probe-3b8244207de64928bb47b4f402cab44b.log`。
  没有点击安装，未创建生产安装记录；原 `Software\OmniMail` 仍无值且仅含原有
  `OmniMailDesktop` 子键，证明没有通过删除开发配置绕过问题。
- 完整五文件修正版交付至 `desktop/bin/releases/v0.0.1-fixed/`，没有覆盖旧包：
  `OmniMail-0.0.1-windows-amd64-setup.exe`，9,256,496 字节，
  文本版本 0.0.1，SHA-256
  `35cba5e55a6456433606650f8adce5bef45488ac98a3f090dbbdf63e17598bc9`。
  与 SHA256SUMS 和签名清单一致，预期签名身份/时间戳存在，Root/My 无临时证书残留。
- 生产/开发首次安装独立选数据目录，默认值区分；兼容读取旧候选记录必须有对应产品卸载标记。
  不自动迁移或删除开发数据，真实已安装生产路径失效仍失败，不回退创建空库。
- 本轮定向 Go 回归及生产安装器入口检查已执行；未做全量 verify、实际安装后程序/邮件业务验收，
  未修改远端 Secrets、未发布 Release。源码混合修改继续未暂存、未提交、未推送。

## 第九轮目录选择器新建文件夹（2026-11-01）
- 用户要求目录选择器能直接创建文件夹。确认数据页使用
  `CreateInputDirPage(..., False, '')`，最后一个空参数关闭了原生 Make New Folder 按钮。
  官方 CreateInputDirPage 文档明确：AppendDir=False 且 NewFolderName 非空即可显示该按钮。
- 采用最小修复：使用已本地化的 `SetupMessage(msgNewFolderName)`，不引入 COM/新依赖或
  手写目录创建逻辑，不擅自向用户所选目录追加 OmniMail；程序目录使用 Inno 内置浏览窗口。
- 保留开发/生产安装记录隔离、取消不改路径和现有路径/可写/互含校验。
  本轮只做相关选择器原生检查，不执行安装或全量 verify；在专用临时目录验证新建文件夹，
  不删除/移动用户数据，不修改签名身份/GitHub 配置，不导入根证书。
- 继续生成 0.0.1 签名生产包，输出新目录供用户使用，不覆盖正在打开的旧安装器。
- 数据选择器已完成原生新建/选择返回/取消保持路径检查。程序目录默认 AppendDefaultDirName=yes，
  仍处于自动追加目录名模式而没有新建按钮；将浏览行为设为 no，让用户选择的目录就是最终目录，
  默认完整安装路径仍为当前用户 Programs 下的独立产品目录，不改变升级固定目录保护。
- 原生 VCL 控件在 UIA 中暴露为 Pane，探针改用限定本进程的原生控件消息读取/操作；
  Inno 的新目录先作为目录树节点编辑，确认数据页时才实际创建。测试按真实语义核对，
  不把辅助自动化的控件识别问题记成产品故障，不在用户真实目录中试建文件夹。

## 第九轮目录选择器交付结果
- 使用同一安装脚本构建隔离开发夹具，原生探针最终通过：
  `DataPickerNewFolder=true`、`SelectedPathReturned=true`、`CancelPreservedPath=true`、
  `ProgramPickerNewFolder=true`、`ActuallyInstalled=false`。
  实际目录创建于 `.task/folder-picker-probe-77a429523dd946448cd3feb32fc25b89/OmniMail-Picker-Probe`，
  没有在用户邮件/开发目录中创建、移动或删除文件夹，没有点击安装。
- 正式生产包重打退出码 0，日志 `.task/t83-release-0.0.1-folder-picker-final.log`；
  原始产物 `.task/release/0.0.1-release-8de0474d7ac243f48617b4ca5f6a473a/`。
- 完整五文件交付至 `desktop/bin/releases/v0.0.1-folder-picker/`，版本仍为 0.0.1，
  安装包 9,254,072 字节，SHA-256
  `a2585708ca97261d1db1feb902781b37bc6f293c4b655ef0771e83e94fd967ce`，
  与 SHA256SUMS/签名清单一致；实际签名与时间戳存在，不是开发探针包。
- 保留第八轮生产/开发隔离修复及原路径保护，旧安装包没有被覆盖。
  本轮无新依赖、无证书/Secrets 轮换、无根证书导入，不运行全量 verify 或实际安装。
  源码仍未提交/推送，未创建远端 Release；整体任务保留进行中。

## 第十轮 0.0.2 本地生产包（2026-11-02）
- 授权范围：用户要求提交代码、构建 0.0.2 生产版本用于本地更新，并更新任务记录。
- 基线提交 `072367750f3f99ff03a655f9aa63b7c59ffe1cc2`（父提交 `5c97c37`），
  包含 TASK-0073～0086 的本地改动；安装包由该提交构建，EXE 内嵌提交号
  `072367750f3f`、程序版本 `0.0.2.0`/展示版本 `0.0.2`。
- 打包前后完整门禁 `go -C desktop tool wails3 task verify` 退出码 0：
  Go 格式/vet/测试、前端 format/lint/typecheck/测试（91 文件 786 项）、构建全部通过；
  日志 `desktop/.task/t86-verify-clean.log`。
- 正式签名打包：`desktop/scripts/release-signing.ps1 -Action Package -Version 0.0.2`，
  使用本机 DPAPI 加密材料（证书指纹 `3BD397BA3312A314126141BDD816905D7D5F5D41`），退出码 0；
  本轮未生成或轮换任何证书/密钥，未导入根证书，未改动 GitHub Secrets。
- 产物目录 `desktop/.task/release/0.0.2-release-6ecfa67b604a4f798b66a2d57e602d5b/`，
  五文件交付副本 `desktop/bin/releases/v0.0.2/`（均在 .gitignore 内）：
  安装包 9,256,376 字节，SHA-256
  `409207d7c8e775215b9bd009ec9186e1b44d0a4f1d2be29c84099f433492562d`，
  与 `SHA256SUMS.txt`、`update-windows-amd64.json` 一致；清单 Ed25519 签名用应用内同一公钥
  独立回验通过；主程序、升级助手、卸载器与安装包 Authenticode 均为 Valid，含 DigiCert 时间戳。
- 构建环境补充事实：本机原先没有 PowerShell 7，而生产打包按设计必须使用 pwsh 7，
  本轮改用官方 `PowerShell-7.6.9-win-x64.zip`（SHA-256
  `ce7484804c0f0ad4dda10c958e71acdaf7eebfb22505c1b480f89e0e9f1da94d`）解压到
  `%LOCALAPPDATA%\OmniMail\release-tools\powershell-7.6.9`，未做系统级安装、未改项目依赖。
- 未执行：真实安装/覆盖升级冒烟、安装后邮件业务验收、GitHub tag 推送与 CI、远端 Release 上传。
  本地安装包不等于正式发布验收；用户自行在本机覆盖安装即为本次更新路径。

## 第十一轮 0.0.2 重打包（撰写入口文案修复，2026-11-02）
- 触发：用户指出未添加邮箱时侧栏“写邮件”标注“待开发”不成立，撰写能力已接入；
  修复见 [TASK-0087](TASK-0087-compose-entry-availability-copy.md)，实现提交
  `43ac80fd`（父提交 `0723677`）。
- 同版本 0.0.2 重打包，产物目录
  `desktop/.task/release/0.0.2-release-4d05c23691284d54a91003e061044c60/`，
  交付副本 `desktop/bin/releases/v0.0.2-compose-hint/`；上一版交付目录
  `desktop/bin/releases/v0.0.2/` 保留不覆盖，便于对照。
- 安装包 9,253,864 字节，SHA-256
  `a266c9eeb5b6e35623f0831ef19bbf20cb0429a459c850bd7a299ad12e6359d3`；
  清单 Ed25519 签名用同一公钥回验通过；Authenticode 有效，签名者 `CN=OmniMail`，
  指纹 `3BD397BA3312A314126141BDD816905D7D5F5D41`；EXE 内嵌提交 `43ac80f`、版本 `0.0.2`。
- 前端全量测试 91 文件 788 项通过（含新增禁用态/加载态用例），
  浏览器核对三种入口状态，日志 `desktop/.task/t87-package-0.0.2.log`。
- 未执行：安装/覆盖升级冒烟与安装后业务验收；未推送 tag、未创建远端 Release。
  同版本重打包仅为本地更新，不代表新的对外版本号。

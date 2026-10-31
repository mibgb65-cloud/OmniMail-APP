# TASK-0055 Gmail 添加失败诊断与修复

> 状态：已完成
> 负责人：@Codex | 创建：2026-10-31 | 优先级：P1

## 需求与目标

用户反馈 Gmail 添加时显示“无法连接邮件服务器”。检查账号配置、IMAP/SMTP 认证和安全错误映射，修复可复现缺陷，提供有证据的排查结论。

## 范围

- 包含：Gmail 添加路径、相关协议错误分类及最小回归测试；必要的中英文错误提示。
- 不包含：读取用户凭据或邮件、真实账号认证、引入 OAuth、代理配置、依赖升级及无关重构。

## 分析

- 初始工作树干净。
- Gmail 预设为 `imap.gmail.com:993` 与 `smtp.gmail.com:465`，均使用隐式 TLS；当前添加流程使用应用专用密码，不是 OAuth。
- 当前 IMAP 登录只把 `AUTHENTICATIONFAILED` 和无响应码的错误归为认证失败；其他响应码都归为网络错误，需用本地协议服务器验证 Gmail 的拒绝分支。
- 本机匿名 TCP 探测：上述 IMAP、SMTP 465/587 均可建立 TCP 连接。这不能证明 TLS、认证或用户截图当时的网络正常。
- 候选方案：优先修复已有错误分类与输入处理，不以增加代理或更换认证方式掩盖问题；如发现需要新产品行为，先说明并确认。
- 匿名 TLS 诊断：IMAP 993 与 SMTP 465 均通过系统证书校验并协商 TLS 1.3，收到 Gmail 服务问候；没有发送用户名或密码。
- 已确认另一处兼容问题：Gmail 应用密码中的显示分组空格会原样送到 IMAP/SMTP 并保存。仅对 Gmail 去除普通空格，保留原始长度/控制字符校验，不修改其他服务商密码。
- 第一实施步：协议认证错误分类与后端密码归一化及回归测试（不超过 6 文件、600 行）；第二步：Gmail 安全提示和界面回归、任务索引、完整门禁。
- 官方依据：[Google 应用专用密码说明](https://support.google.com/accounts/answer/185833?hl=zh-Hans)、
  [Gmail 邮件客户端说明](https://support.google.com/mail/answer/7126229?hl=zh-Hans)。
  应用密码需两步验证；个人 Gmail 的 IMAP 自 2025 年起始终启用，不能误导用户寻找“启用 IMAP”开关。
  OAuth 是官方推荐的长期方案，但当前项目尚未实现，本轮不虚构支持。

## 实施计划

1. [x] 核对相关文档与实际代码，完成匿名 TLS/协议诊断，确定可复现问题。
2. [x] 先补失败回归测试，再分步修复；单步不超过 10 文件、600 行。
3. [x] 执行针对性测试及完整 verify，审阅差异并回填结果。

## 验收标准

- [x] 可复现的 Gmail 添加缺陷有先失败后通过的测试证据。
- [x] 本轮覆盖的认证、网络与 TLS 失败分类正确，不输出服务器原始错误、密码及账号隐私。
- [x] 不改变其他服务商的密码语义，不降低 TLS 或输入校验要求。
- [x] 交付包含实际验证和真实 Gmail 尚未验收的限制。

## 风险与依赖

- 截图仅有通用错误，无法据此确定真实账号失败的具体协议阶段。
- 不使用用户密码；真实 Gmail 添加、同步仍需用户在本机更新后的应用中验收。

## 实现结果

- `mailnet/authentication.go` 按协议结构分类登录失败：IMAP 的 `NO [ALERT]`、认证/授权失败、过期等映射认证错误；临时不可用保留网络错误，隐私要求映射 TLS，BAD/未知响应保留协议错误。SMTP 区分 534/535、454、538、504 和断线。不匹配或输出原始服务器文本。
- Gmail 添加在原始长度/控制字符校验后移除普通分组空格；IMAP、SMTP 验证与系统凭据保存均使用归一化值。空格移除后为空则在联网前拒绝；QQ、网易、自定义保持原密码语义。
- 单账号、批量验证中和批量失败编辑态共用 Gmail 专用安全提示，中英文同步；其他服务商仍用通用错误。没有修改数据库、公开 API、依赖、TLS 校验或代理配置。
- 新增本地 TLS 协议失败回归、凭据认证/保存一致性及输入边界回归、界面错误指引和敏感文本不展示测试。

## 验证记录

| 日期 | 命令或核对项及覆盖范围 | 实际结果/失败原因 |
| --- | --- | --- |
| 2026-10-31 | `git status --short` | 初始工作树干净 |
| 2026-10-31 | .NET TcpClient 匿名探测 Gmail IMAP 993、SMTP 465/587，单端口最多等待 6 秒 | 三个端口均可建立 TCP；未进行账号认证 |
| 2026-10-31 | 匿名 SslStream 探测 IMAP 993、SMTP 465 | TLS 1.3 与系统证书校验成功，收到服务器问候；不记录问候原文或客户端 IP |
| 2026-10-31 | `go -C desktop test ./internal/mailnet ./internal/service -run 'Test(IMAPLoginFailureClassification\|SMTPAuthFailureClassification\|AuthenticationCancellation\|AccountAppPasswordNormalization\|GmailAppPasswordValidationBeforeNetwork)$' -count=1`（修复前） | 失败：IMAP ALERT/授权过期误报网络，BAD 误报认证；SMTP 临时故障/TLS/协议/断线误报认证；Gmail 分组密码与全空格校验失败 |
| 2026-10-31 | 同上定向命令（修复后），另以 `-count=10` 重复 | 通过；包括补充的未知响应、管理员拒绝、原始输入边界和其他服务商密码保留 |
| 2026-10-31 | `go -C desktop test ./internal/mailnet ./internal/service -count=1` | 两个包通过 |
| 2026-10-31 | `npm run test -- src/components/MailDialogs/SameProviderBatch.test.tsx`，目录 `desktop/frontend` | 新增指引断言先失败；修复后 12/12 通过。测试编写中的标签不匹配、mock 队列残留及批处理异步节点断言已修正，未删合理断言 |
| 2026-10-31 | `go -C desktop test -race ./internal/mailnet ./internal/service -run 'Test(IMAPLoginFailureClassification\|SMTPAuthFailureClassification\|AuthenticationCancellation\|AccountAppPasswordNormalization\|GmailAppPasswordValidationBeforeNetwork)$' -count=1` | 未执行测试：环境 CGO_ENABLED=0 且无可用 gcc/clang；未安装或改动全局工具 |
| 2026-10-31 | `go -C desktop tool wails3 task verify`（首次） | 格式、Go vet 通过，前端 lint 发现迁移提示后的未使用 import，已修复；首次不算通过 |
| 2026-10-31 | `go -C desktop tool wails3 task verify`（重跑） | 退出码 0；Go/前端格式、Go vet、ESLint、TypeScript、全量 Go 测试、前端 59 文件 / 536 测试、绑定生成及 Windows production 构建全部通过 |
| 2026-10-31 | `git diff --check`、变更文件严格 UTF-8 解码与 BOM 检查 | 通过；包含新增文件共 14 个文本文件，无 BOM；绑定生成未引入额外受版本控制的变动 |
| 2026-10-31 | 真实 Gmail 登录/同步及原生弹窗人工验收 | 未执行；未读取用户凭据、未尝试真实账号登录；不能由本地模拟测试宣称真实接入通过 |

## Git 与交付

- 首次交付时提交/推送授权：均未授权。
- 首次交付时关联实现提交：未提交，待评审；当时保留 active。最终处置见完成记录。
- 用户既有改动：无，不修改用户运行目录、凭据或邮件数据。
- 验证构建：`desktop/.task/verify-bin/OmniMail.exe`；verify 不覆盖常规运行产物。随后按用户要求启动 `task dev`，第二轮修复已热重启到桌面窗口，继续使用 `.devdata`。
- 第一轮遗留风险当时为“尚无真实失败阶段证据”；第二轮已通过用户重试定位并修复 IMAP 认证后清理误判，用户确认添加成功。OAuth 未新增，邮件完整同步/实际发送仍不在已验收结论内。

## 第二轮：开发版仍返回网络失败（2026-10-31）

### 用户反馈与新增证据

- 用户在启动的新开发版中重试，截图仍显示 Gmail 网络错误；上一轮未解决真实账号接入问题，不能以测试通过宣称修复完成。
- 开发日志确认新构建启动，但现有添加路径没有协议阶段日志，无法从历史日志定位这一次失败。已有邮件同步日志不等于 Gmail 添加成功。
- 保留上一轮全部未提交改动；不读取表单秘密、凭据库或邮件数据，不进行真实账号认证。

### 本轮计划（先记录后修改）

1. [x] 使用 Go 的 DNS/TCP/TLS 与协议库，匿名对比默认/IPv4/IPv6 连接、IMAP CAPABILITY/ID 和 SMTP EHLO，诊断脚本仅放忽略的 `.task/`。
2. [x] 根据实测证据补可复现失败测试，再做最小修复；如无法匿名定位认证后的失败，只加入不含原始响应/账号/主机/凭据的阶段诊断，明确要求用户在本机重试而非猜测根因。
3. [x] 运行相关测试和完整 verify；确认开发应用重载，回填实际结果、限制和 Git 状态。

### 范围与安全边界

- 不新增代理设置、不强制 IPv4、不更改 OAuth 或 SMTP 端口，除非诊断证据明确且涉及行为变更时先取得确认。
- 诊断只记录白名单协议/阶段/原因码，不记录原始命令、错误文本、用户名、密码、服务器返回的客户端 IP 或邮件内容。
- 需要重启热更新时只操作本次已启动的开发进程，保持数据目录不变，不触碰其他应用。

### 本轮结果

- 两轮 Go 匿名探测：默认和 IPv6 的 IMAP CAPABILITY/ID/NOOP、SMTP EHLO/QUIT 均成功；首轮 IPv4 SMTP TLS 收到 EOF，第二轮所有路径成功。不据此强制 IPv4 或改端口。
- 已增加传输阶段安全错误包装、添加账号失败的白名单阶段日志。新增测试先因缺少阶段/日志失败，修复后定向重复 10 次通过。
- 诊断代码的完整 verify：首次因既有 `App.test.tsx` 的 tooltip 超时失败（535/536）；该文件单独重跑 15/15 通过，未改动该测试；完整 verify 重跑通过（536/536、Go 测试、Windows 构建）。
- **11:07:46 用户本机重试的真实日志**：`protocol=imap stage=close reason=unknown code=NETWORK_FAILED`。该路径仅在 `transport.Connect` 已成功返回后执行，证明本次 IMAP 登录成功，添加被随后的连接清理错误中止，SMTP 尚未验证。没有读取密码或服务器原文。

### 第三步实施计划：修复认证后的清理失败（先记录后修改）

1. [x] 补服务层失败测试：IMAP 认证后清理失败不应阻止 SMTP 验证；SMTP 失败仍不得保存账号/凭据；取消仍须中止。
2. [x] 将认证成功后的 IMAP 清理失败改为安全警告，不改变认证失败拒绝添加的规则；核对 SMTP 认证后 QUIT 的同类分支并补测试，避免清理问题再次伪装为认证失败。
3. [x] 跑定向回归和完整 verify，核对开发应用热重启；用户已确认真实 Gmail 添加完成。

### 第三步实际结果与用户验收

- 修复前定向测试复现：IMAP 清理失败覆盖了成功结果、SMTP 拒绝结果和取消结果；SMTP AUTH 成功后的 QUIT 断线同样误报 `NETWORK_FAILED`。
- 修复后 IMAP 清理失败仅写白名单警告，继续 SMTP 验证；SMTP AUTH 成功后的 QUIT 清理失败不推翻验证。收发两段验证完成后以及保存前继续检查取消状态；SMTP 拒绝和取消均不保存账号/凭据。
- `go -C desktop test ./internal/mailnet ./internal/service -run 'Test(AuthenticatedIMAPCleanupDoesNotRejectAccount|SMTPVerificationKeepsSuccessfulAuthenticationAfterQuitFailure|AccountValidationFailureLogsOnlySafeStageMetadata|ConnectionFailureIncludesSafeAuthenticationStage|AccountAppPasswordNormalization|FailedAuthenticationOrCredentialsDoesNotSave)$' -count=10` 通过，覆盖两阶段验证、清理、凭据补偿和取消。
- 开发应用已于 11:10:57 自动载入修复，数据目录不变。用户再次在本机重试后回复“完成了”，确认 Gmail 添加已完成。11:13:46 的安全日志记录清理失败为非阻断警告，没有再次出现该次账号添加失败事件。
- 未读取真实账号密码或邮件正文；用户已确认添加完成，不据此宣称新 Gmail 的全部邮件同步或实际收发均已验收。同步日志不携带账号标识，不能将其他账号的 `SYNC_COMPLETE` 当成新 Gmail 验收。
- 第三步交付时未提交或推送；当时“完成了”按用户操作结果记录，不视为 Git 提交/归档授权，当时仍留 active 待评审。
- 清理修复后的最终 `go -C desktop tool wails3 task verify` 退出码 0：格式、静态检查、类型检查、全量 Go 测试、59 文件 / 536 前端测试、绑定生成、Windows production 构建全部通过。`git diff --check` 与累计 19 个变更文件的严格 UTF-8 无 BOM 检查通过；绑定未引入额外受版本控制的改动。`-race` 仍受前述 CGO 环境限制，未宣称通过。
- 后台遗留项：11:14:47、11:16:01 出现 `MAIL_PROTOCOL_FAILED / stage=select / mailbox_kind=other / reason=command_no`。安全日志不包含账号标识，无法归因到本次 Gmail，不能据用户添加完成宣称邮件同步全部成功；本轮不盲改服务商文件夹或忽略合理同步错误。

## 提交与结案轮（2026-10-31）

### 授权与计划

- 用户明确要求“提交代码完成任务记录”，授权本任务本地提交、完成记录和归档；未授权推送、切换分支或其他任务的代码变更。
- 本轮起始差异均为本任务累计 19 个文件，暂存区为空；保留原有分步实现和验证历史，不将早期“未提交/未定位”改写为当时已完成。
- [x] 审阅全部本任务代码与新增测试，复核定向测试、差异与敏感文件边界；代码未变，沿用上一轮已通过的完整 verify，不把文档结案声称为新增真实收发验证。
- [x] 补充变更日志，将未归因的文件夹选择失败转交 TASK-0037 后续清单，不扩大本任务的成功范围。
- [x] 仅显式暂存本任务文件，创建实现提交；取得真实 SHA 后登记、移动同一任务记录至 `archive/2026/10/`、更新索引，再以文档提交完成结案。不得预填 SHA 或 amend 追逐自身哈希。

### 本轮结果

- 提交前复核：`go -C desktop test ./internal/mailnet ./internal/service -count=1` 两个包通过；
  `npm run test -- src/components/MailDialogs/SameProviderBatch.test.tsx`（目录 `desktop/frontend`）12/12 通过。
- 上轮完整 verify 后没有修改代码或配置，本轮仅补充结案文档；完整门禁结果与未运行的 race 限制仍按前述记录保留。
- 用户已授权本地提交；实现提交已创建，真实 SHA 见下方完成记录。

## 完成记录（2026-10-31）

- 用户已确认真实 Gmail 添加成功，并明确授权“提交代码完成任务记录”；本任务验收范围为账号添加修复，不扩大为完整同步/实际发送验收。
- 实现提交：`55815d1db730fe94a6612bdfd33ec447e63f7f60`
  （`fix(mail): 修复 Gmail 添加时连接清理误报失败`）。
- 验证：最终完整 `go -C desktop tool wails3 task verify` 通过，包含 Go/前端格式、静态检查、类型检查、全量 Go 测试、59 文件 / 536 前端测试、绑定生成与 Windows production 构建；提交前 Go 两包和前端 12 项定向回归再次通过。
- 边界：未读取用户密码或邮件正文，未新增依赖、数据库迁移、OAuth 或代理配置；`-race` 因 CGO 工具链限制未运行，macOS 未验收。
- 后续同步选择失败已转交 [TASK-0037](../../../active/TASK-0037-mail-advanced-followups.md)，不将其记录为本任务已修复的能力。
- 文档：当前索引、月度归档索引、变更日志和后续清单已更新；同一任务记录移入归档，不保留冲突副本。
- Git：仅本地 `main` 提交，未推送、未切换分支、未重写历史；早期“未提交/未定位”保留其当轮历史含义。
- 状态：已完成；完成/归档日期：2026-10-31。

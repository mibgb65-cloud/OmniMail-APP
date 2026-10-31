# TASK-0066 NAVER 同步兼容与邮箱侧栏布局

> 2026-11-01 收尾：用户已接受本批交付并授权本地提交，未授权推送；联合验证和归档由 TASK-0072 登记。下方未授权文字保留当轮历史含义。

> 状态：待评审
> 负责人：@Codex | 创建：2026-10-31 | 优先级：P1

## 用户需求与范围
- 修复 NAVER 已添加账号无法同步；只依据真实诊断/协议证据处理，不降低认证/TLS 或编造 UIDVALIDITY。
- 移除邮件列表顶部的账号同步告警，保留左侧邮箱红点的说明/重试及账号管理反馈。
- 邮箱列表扩展到设置/通知栏上方的可用空间，状态点固定靠右并上下对齐。
- 使用 CSS `mask-image: linear-gradient(...)` 为该邮箱列表提供上下边缘羽化，不使用背景色遮挡伪元素。
- 不包含新服务商、凭据读取、数据库迁移或无关重构；不自动提交/推送。

## 初始工作树与证据
- 工作树已有 TASK-0061～0065 未提交变更，全部保留。
- 安全日志仅筛选 `provider=naver`：2026-10-31 19:33～19:47 多次出现
  `MAIL_PROTOCOL_FAILED / stage=select / mailbox_kind=inbox / reason=missing_uidvalidity`。
  这定位为文件夹选择元数据缺失，不是从截图推断密码错误；没有读取凭据或邮件正文。
- 邮箱列表当前 `max-height=192px`，侧栏剩余空间未分配给列表；状态按钮紧邻不同长度名称而非固定列。
- 下一步核对 SELECT/STATUS 元数据恢复能力，并对新的羽化测量/滚动与现有窄槽滚动条做兼容验证。
- 已核对当前路径：先 EXAMINE，缺字段时 STATUS；两者仍缺 UIDVALIDITY 即失败。仅对官方 NAVER
  IMAP 主机允许一次普通 SELECT 补取真实元数据，后续仍 BODY.PEEK，不发送 STORE/CLOSE/EXPUNGE；
  其他服务商保持原只读策略，STATUS 权限/认证失败不触发降级，仍缺身份或冲突必须失败。
- 这是针对已观察故障阶段的安全兼容，不把本地合成测试宣称为真实 NAVER 账号恢复。
- 邮箱区采用 flex 分配剩余高度：标题/添加/底栏不压缩，列表独立滚动，移动端保持有界高度；
  状态列固定，mask 仅作用于内容视口，不遮罩滚动条及浮层。
- 列表顶部仅保留初始账号读取失败、无账号空态等必要提示；同步/重授权/受限/断开细节在左侧及管理窗展示。
- 中断前新增回归已复现：工具栏同步请求拒绝仍被写进全局账号读取错误。续作先修复该路径，
  将安全错误码保留在本次账号范围的状态中，BUSY 刷新真实状态，随后重新跑定向/完整门禁。

## 分步计划（每步不超过 10 文件/600 行）
1. [x] 核对协议实现/测试与 UI 布局，记录最小修复设计。
2. [x] 先复现缺失 UIDVALIDITY 的失败测试，安全恢复服务器真实数据并验证。
3. [x] 移除列表顶部账号告警，扩展侧栏、固定状态点列、加入 mask 渐隐及相关回归。
4. [x] 更新文档，执行浏览器/定向/完整 verify，审阅差异与剩余风险。

## 验收标准
- [x] NAVER 选择缺字段有安全兼容，UIDVALIDITY 必须来自服务器；状态失败/权限/缺失仍不能当成成功。
- [x] 邮件列表不再重复账号同步错误；左侧红点/悬浮重试和管理窗仍可追踪失败。
- [x] 桌面邮箱列表占满剩余高度，添加入口可见且底部设置栏固定不被挤出；窄窗口不失控。
- [x] 不同名称长度的状态点右侧同列，长名称省略，完整地址可访问。
- [x] 渐隐只作用于内容滚动边缘，使用 mask，适配亮暗背景；滚动条与指针/键盘交互正常。
- [x] 完整门禁通过；真实服务商结果及未验证项如实报告，未提交/推送。

## 实现与验证、Git
- 协议：仅匹配官方 NAVER IMAP 主机（忽略大小写/末尾点）的会话开启缺失身份补取。
  先 EXAMINE/STATUS，有真实身份则不触发普通 SELECT；两者均缺失时至多补取一次，
  使用新的服务器快照并丢弃无身份旧快照的 UIDNEXT，仍缺 UIDNEXT 时沿用受限 UID SEARCH 上界。
  SELECT/STATUS 拒绝或仍缺身份继续报错，补取后仍缺失的安全原因是 `missing_uidvalidity_after_select`。
- 不修改 IMAP 库或升级依赖，不伪造身份；后续 BODY.PEEK 不变，不发送 STORE/CLOSE/EXPUNGE。
  兼容路径基于观察到的故障阶段实现，真实 NAVER 账号恢复尚未验收。
- UI：邮件列表不再呈现账号同步/重授权/受限/断开告警，保留账号读取失败、未配置及列表自身读取/操作错误；
  内部账号状态仍用于抑制同步失败时误报“此文件夹没有邮件”。
- 工具栏发起同步的请求级失败也只写本次账号范围的安全错误码，不冒充列表读取失败；
  BUSY 刷新已有真实任务状态。保持既有筛选会话边界及后续后台轮询。
- 邮箱列表桌面 flex 填满剩余高度，添加/底部栏不收缩；移动端保持有界，名称列弹性占位，
  状态点固定靠右，现有设置入口、同步流光、窄槽滚动条和 Portal 提示保留。
- 可选 `ScrollArea.edgeFade` 仅用于该邮箱列表，16px CSS mask 依赖真实上下剩余内容；
  到达对应首尾或无溢出时不羽化该边缘。轨道及状态浮层不参与遮罩，不用背景伪元素。
- 文档已更新：收件箱、账号向导 NAVER 兼容说明、滚动组件规范、变更日志与 active 索引。

## 实际验证

| 日期 | 命令或范围 | 实际结果 |
| --- | --- | --- |
| 2026-10-31 | NAVER 安全日志筛选 | 定位 `stage=select / reason=missing_uidvalidity`；未读取真实凭据或正文 |
| 2026-10-31 | 缺身份补取测试（实现前） | 因会话缺少兼容字段失败；补充实现后执行真实本地 TLS fixture 通过 |
| 2026-10-31 | `go -C desktop test ./internal/mailnet -run 'TestSelectRecoversMissingMetadata\|TestMailboxes\|TestIMAP'` | 通过：完整元数据不补取、STATUS/SELECT 拒绝、一直缺身份、UID 溢出、身份冲突、旧 UIDNEXT 丢弃均被覆盖 |
| 2026-10-31 | 顶部提示/边缘遮罩回归（实现前） | 3 失败：旧同步/受限提示仍显示，组件未支持 edgeFade |
| 2026-10-31 | `npm test -- src/app/MailContent.test.tsx src/app/MailboxAccounts.test.tsx src/components/ScrollArea` | 5 文件/50 测试通过 |
| 2026-10-31 | `npm test -- src/app/useMailRetry.test.ts`（请求级错误修复前） | 新用例复现 TIMEOUT 被写入全局读取错误；修复后通过 |
| 2026-10-31 | `npm test -- src/app/useMailRetry.test.ts src/app/MailUnreadSession.test.tsx src/app/MailContent.test.tsx src/components/ScrollArea` | 6 文件/51 测试通过，筛选会话与错误显示范围不回归 |
| 2026-10-31 | `go -C desktop test ./internal/mailnet ./internal/service` | 全部通过 |
| 2026-10-31 | `node desktop/.task/t66-browser-check.mjs` | Chromium 模拟数据通过：1180×960 列表高375.08px（突破192px），20 个状态点横坐标差为0；首/中/尾条件 mask、无背景伪元素、轨道/Portal 无 mask、左侧重试、900×760 布局和键盘滚动通过，无 pageerror |
| 2026-10-31 | `go -C desktop tool wails3 task verify`（最终代码） | 完整通过：Go/前端格式、Go vet、ESLint、类型检查、全量 Go 测试、前端71文件/633测试、绑定、前端生产构建、Windows资源及程序构建 |
| 2026-10-31 | `git diff --check`、文本 UTF-8 无 BOM、新文档引用 | 通过，未新增依赖、接口字段或迁移；此前各任务改动保留 |

### 产物与验证边界
- 最终门禁日志：`desktop/.task/t66-verify-final.log`。
- 验证程序：`desktop/.task/verify-bin/OmniMail.exe`；没有覆盖/重启 `desktop/bin/OmniMail.exe`。
- 本地浏览器夹具/脚本位于忽略的 `desktop/.task/t66-*`，使用 `.invalid` 模拟数据，不向真实邮箱提交请求。
- 截图：`C:/Users/mimanchi/.codex/visualizations/2026/10/31/01a1910b-39fa-7021-ab01-8379dfaa9c46/t66-sidebar-{light,dark,detail-light,detail-dark}.png`。
- 未从现有日志观察到新版本的 NAVER 成功同步，不把合成 TLS 测试扩展为真实账号已恢复；
  应在运行新版本后从侧栏红点重试并查看新的安全诊断。macOS WebView 与真实小屏窗口未原生验收。

## Git 与交付
- 提交/推送均未授权；未提交、未归档，保留全部前轮变更。
- 交付状态：实现及验证已完成，待用户评审。
- 风险：若 NAVER 在补取后仍不返回有效身份，仍会明确失败，不能生成假值或用旧数据库身份替代。
  普通 SELECT 兼容仅限官方主机且不发送写入命令；需真实账号确认该服务端能否通过该路径恢复。

## 2026-10-31 续轮：真实 NAVER 仍然同步失败
- 用户反馈已运行开发版本，NAVER 账号仍提示服务器响应或邮件格式不受支持。
- 新安全日志 21:29、21:30 显示 `stage=select / reason=missing_uidvalidity_after_select`：
  前轮 SELECT 补取已执行，不能再把重复补取当作修复。
- 本轮状态：进行中；先核对客户端对 UIDVALIDITY 的解析与缺失/零值区别，必要时进行仅输出
  白名单元数据的只读协议诊断；不输出凭据、邮箱地址、服务器原文或邮件正文。
- 计划：定位真实响应形态 → 新增失败回归 → 最小协议兼容修复 → 定向测试及完整 verify →
  在开发窗口重试并核对新日志。若必须改变身份/缓存安全语义，先说明影响取得确认，
  不伪造身份或直接沿用旧缓存值。
- 保留工作树已有其他任务修改，不新增依赖、不迁移数据库、不提交或推送。
- 本轮修复与完整验证尚未执行，前轮通过结果不代替本轮验证。
- 诊断方式：临时忽略目录中的本地 Go 工具以只读 SQLite 获取唯一 NAVER IMAP 配置，
  通过项目凭据适配器仅在进程内取得该账号密码并以正常 TLS 登录；只执行
  EXAMINE/STATUS/SELECT/LOGOUT，不 FETCH、STORE、CLOSE 或 EXPUNGE。
  输出限制为命令结果与白名单元数据的存在/零值/大小写形态，绝不转储收发原文。
- 真实只读诊断已执行成功：TLS 登录成功，EXAMINE、STATUS、SELECT 均成功，
  且三条命令均**明确返回 UIDVALIDITY=0**，UIDNEXT 为非零；字段是大写、非 tagged
  响应，STATUS 邮箱匹配 INBOX。因此不是漏解析、密码失败，也不是完全没返回该字段。
  临时诊断工具已移除，输出没有真实地址、凭据、邮件或服务器原文。
- 已核对阻塞点：协议层和服务层把零当作缺失；仓储校验同样拒绝零，
  `0002_mail.sql` 的 mailbox/mail_message 约束为 1～4294967295。
  单独改 SELECT 重试或只放宽协议层均不能完成安全闭环。
- 方案取舍：不把零映射为 1/最大整数，不直接复用旧身份，不删除账号重加。
  完整兼容应区分“服务端明确零值”和“字段缺失”，限定官方 NAVER，真实保存零值；
  这需要新数据库约束迁移及同步/正文/标记身份校验联动，且零值服务端无法提供标准的
  UID 纪元变更保证，须设计保守缓存重核对策略。
- 当前等待用户确认上述数据库迁移及兼容安全语义，尚未修改生产协议、同步、仓储代码或数据库，
  未运行本轮修复测试/verify，未宣称实际同步恢复。任务保持 active/进行中，不提交、不推送。

## 授权后的实施计划
- 用户明确回复“修复吧”，授权本轮零值兼容、迁移前备份和回归验证；不包含提交/推送授权。
- 分步实施，每步最多 10 文件/600 行：
  1. 协议层：限定官方 NAVER 的 TLS 会话，跟踪 SELECT 响应是否明确包含零值；
     缺字段、冲突、其他主机仍拒绝。先本地 TLS 失败回归再实现。
  2. 仓储层：新增 v5 约束迁移（保持历史迁移不变），复用 VACUUM INTO 备份；
     仅允许官方 NAVER 账号保存零值，UID 重用导致头部身份变化时替换旧缓存实例。
  3. 服务层：仅接受协议层明确确认的零值，零值邮箱分批重核对摘要；
     正文下载前后核对头部身份，不在未核对的 UID 上写入正文。
     无可靠纪元的零值邮箱暂不支持远端标记/移动，避免误操作其他邮件。
  4. 更新数据库/兼容文档、执行定向及完整 verify，通过后重启开发窗口，
     核对备份、迁移和真实同步的安全日志。未验证的结果不预填通过。
- 先正常关闭当前开发窗口，避免热重载在迁移/测试尚未完成时打开真实数据库。

### 本轮阶段结果
- 已正常关闭开发窗口及其开发服务器；真实库尚未升级，等待完整门禁通过后重启。
- 协议失败回归：`go -C desktop test ./internal/mailnet -run '^TestSelectAcceptsExplicitZeroOnlyForNaver$' -count=1`
  实现前失败（NAVER 明确零被当作缺失），实现后通过；新增分片、literal 伪造、冲突、越界、
  超长行、跨选择状态清理回归，`TestSelect|TestMetadataObserver` 通过。
- 仓储失败回归：`go -C desktop test ./internal/repository -run '^TestZeroValidity' -count=1`
  实现前零值保存及 v5 备份断言失败；实现后通过，旧正文/附件/标记保留及中途失败回滚已测试。
- 服务失败回归：`TestSyncExplicitZero|TestZeroBody|TestZeroValidityRemote` 实现前失败，
  实现后通过；缺失身份仍拒绝，下载前/后 UID 重用不落错误正文，远端写明确返回不支持。
- `go -C desktop test ./internal/domain ./internal/repository ./internal/mailnet ./internal/service -count=1`
  最终本轮定向全包通过。首次全包曾遇既有成功日志测试偶发竞态，单测重复 5 次及整组重跑通过；
  未为通过门禁删除或放宽测试，后续完整门禁仍需验证。
- 完整 verify、真实库迁移、真实账号同步结果待执行，不预填通过。
- 2026-10-31 22:16 完整 `go -C desktop tool wails3 task verify` 已通过：
  Go/前端格式、vet/lint、类型、全量 Go 测试、前端 71 文件/633 测试、绑定、
  前端生产与 Windows 构建全部通过；日志 `desktop/.task/t66-zero-verify.log`。
- 重启前只读核对：真实开发库为 schema v4，12249 条邮件均有正文，508 个附件引用，
  NAVER 尚无缓存邮件。已启动新的 dev 构建，等待应用打开并检查 v5 备份及同步结果。
- 真实升级已完成：备份 `pre-migration-v0005-2H3IWWPFRDDORWUX3LDTTWF22S.db` 为 schema v4，
  含原有 12249 条缓存正文与 508 个附件引用；当前库 schema v5。
  只读对比备份：旧正文/HTML/版本及旧附件引用缺失或改变数量均为 0；
  `integrity_check=ok`、`foreign_key_check` 违规为 0。
- 新应用已从 NAVER 保存 10 条摘要，正文逐批增加，日志 `SYNC_PROGRESS`，
  未再出现先前选择身份缺失；继续观察周期完成，尚不将进度事件宣称为完成。
- 元数据观察方法保留单个连续有界帧状态机（略超 60 行），目的是让 literal 长度消费、
  分片、行上限和失效路径在一处审计，不引入独立通用协议解析框架。

### 本轮交付验证（2026-10-31）
- 真实 NAVER：22:20:15 日志为 `SYNC_COMPLETE / provider=naver`；本次服务器范围 10 条摘要，
  10 条正文均已缓存，1 个零 UIDVALIDITY 邮箱。此前的 `missing_uidvalidity_after_select` 未再出现。
  这验证本地此账号本轮同步，不等同于所有 NAVER 账号、全部历史范围或远端写入认证。
- 已新增“待补正文 UID 重用先替换实例、下一轮下载新实例”的回归，
  `go -C desktop test ./internal/service -run 'TestSyncExplicitZero|TestZeroBody|TestZeroValidityRemote' -count=1`
  在完整门禁之后补跑通过；门禁后没有修改生产 Go/前端代码。
- `git diff --check`、新增 SQL/ADR 的 UTF-8 无 BOM 检查通过。绑定按构建任务生成，
  本轮没有新增对外桥接方法；保留此前任务已有生成模型变更。
- 当前环境 `CGO_ENABLED=0` 且没有 GCC，未执行 Go race 检查；已有锁和 TLS 分片回归通过，
  不把普通测试当作 race 检查。macOS 与其他真实 NAVER 账号未验收。
- 新开发窗口运行 `desktop/bin/OmniMail.exe`，Wails/Vite 热更新开启；启动期仍有原有
  `CANCELED` Promise 警告，本轮未改该前端运行时问题，未阻止此次实际同步完成。
- 兼容降级：仅此类零值邮箱的远端已读/星标/MOVE 明确不支持，不能误称全功能恢复；
  不读取正文验证 UI 显示，也不发送测试邮件。零值缺失标准纪元保证的局限见 ADR-0010。
- Git：本轮修改与既有 TASK-0061～0066 变更共存，混合文件不擅自拆出或暂存；
  未提交、未推送、未归档，待用户评审。

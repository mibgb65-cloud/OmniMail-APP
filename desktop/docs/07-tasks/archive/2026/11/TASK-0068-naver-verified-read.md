# TASK-0068 NAVER 自动已读与安全标记修复

> 2026-11-01 收尾：用户已接受本批交付并授权本地提交，未授权推送；联合验证和归档由 TASK-0072 登记。下方未授权文字保留当轮历史含义。

> 状态：已完成
> 实现提交：be3b7596d6b299a6a210c4257181bb1e71867deb | 归档：2026-11-01 | 本地提交，未推送
> 负责人：@Codex | 创建：2026-10-31 | 优先级：P1
> 关联：[TASK-0066](TASK-0066-naver-sync-sidebar-layout.md)、[ADR-0010](../../../../02-architecture/adr/ADR-0010-naver-zero-uidvalidity.md)

## 需求、证据及边界
- 用户反馈 NAVER 正文可阅读，但自动标为已读失败，错误说明却指向安全移动能力。
- 原因已定位：TASK-0066 的零 UIDVALIDITY 只读兼容在 `writeMessage` 统一拒绝全部写入，
  `SetRead` 无例外；`ACTION_UNSUPPORTED`/`ACTION_UNCERTAIN` 的文案只描述移动。
- 本轮用户明确要求修复已读：仅恢复 NAVER 官方 TLS 端点的已读/未读（自动与工具栏共用），
  不放宽星标、MOVE 或通用零值写入，不伪造纪元，不改数据库结构/凭据。
- 工作树保留 TASK-0061～0067 等已有未提交修改；不提交、推送或新建工作树。

## 方案与分步计划（每步不超过 10 文件／600 行）
1. 服务回归先复现零值 SetRead 被拦截；增加可选“凭完整摘要验证已读”的会话能力，
   仅 SetRead 可请求该能力，官方账号/主机/端口/TLS 再校验，服务器成功后才落本地。
2. 协议回归先覆盖真实本地 TLS：在同一连接上 SELECT 并观察明确零值，
   写入前比对 UID、Message-ID、主题、地址、日期、大小；只增减 Seen，
   校验 UID STORE 回执，再核对身份与最终 Seen。缺少有效 Message-ID 或身份不符不发送 STORE。
   不自动重试不确定写入，不发送 CLOSE/EXPUNGE。
3. 泛化不支持/结果不确定的中英文提示，避免已读错误误报目标文件夹；
   验证自动已读失败后的手动重试和清除提示，保留正文及未读筛选会话行为。
4. 更新 ADR/兼容文档，执行完整 verify，重启开发版。真实账号仅做保持当前已读状态的
   单封幂等核验，不批量标为已读、不展示邮件内容/账号/凭据。

## 安全局限与取舍
- 不直接删除全局零值保护；只有明确申请且由协议实现的已读验证能力可进入兼容路径。
- 同连接前后摘要核对降低常见 UID 重用风险，但不是远端原子事务；服务器同时复用 UID 和
  所有不可变摘要时仍无标准纪元保证。写后身份/回执不符返回结果不确定，不冒称未执行。
- 正常关闭现有开发窗口后修改 Go，避免尚未完成的实现触发真实账号热重载。

## 验收
- [x] NAVER 明确零身份的已读/未读经核验成功后更新本地；失败不伪造成功。
- [x] 缺字段、非官方端点、身份缺失/不符无写入；星标和移动继续拒绝零值。
- [x] Seen 以增删方式写入，保留其他标记，拒绝错误 UID/错误标志回执。
- [x] 自动已读与手动重试不再显示专属移动文案，正文和筛选行为不回归。
- [x] 完整门禁与实际验证边界如实记录。

## 实现与验证
- 已正常关闭运行中的开发窗口，避免中间代码触发真实账号热重载。
- 服务层回归实现前复现失败：经核验的 SetRead 仍被全局零值保护拦截。
  增加操作种类和独立已读能力后通过；端点变更、远端失败、落库前实例替换、
  星标/移动不放宽均已测试。
- 真实本地 TLS 协议回归实现前复现“缺少经核验的 NAVER 已读能力”，实现后通过：
  已读/未读、空 FLAGS 回执后独立 FETCH、非允许端点、正纪元/缺存在性、无 Message-ID、
  摘要不符、服务器 NO、错误 UID/FLAGS、写后身份变更均覆盖。
- 本地服务夹具明确只用 `Seen` 增删，保留 Flagged；错误其他 UID 回执可能被上游作为
  unsolicited 更新忽略，因此独立最终 FETCH 也必须核对 Seen，不能只检查 tagged OK。
- `go -C desktop test ./internal/service -run 'TestZeroRead|TestZeroValidityRemoteWrites' -count=1`
  与 `go -C desktop test ./internal/mailnet -run 'TestZeroRead|TestRealTLSStarred' -count=1` 已通过。
- 前端定向 `npm test -- src/app/MailLoading.test.ts src/app/MailUnreadSession.test.tsx src/app/MailContent.test.tsx src/lib/i18n`
  9 文件／105 测试通过：自动失败保留正文，手动重试成功清除提示和更新未读，中英文键一致。
- 本轮 writeMessage 维持既有单一编排函数（超过 60 行），使连接、远端写入、短提交锁、
  标记版本和本地持久化边界集中可审计；不为本次增加通用事务框架或无关重构。
- 完整 verify、真实幂等核验及开发窗口重启待执行，未预填通过。
- `go -C desktop tool wails3 task verify` 已完整通过：Go/前端格式、vet/ESLint、类型检查、
  全量 Go 测试、前端 71 文件／635 测试、绑定、前端生产构建及 Windows 构建。
  日志：`desktop/.task/t68-verify.log`。本轮无新增依赖、迁移或对外桥接字段。
- 真实单封幂等核验已通过：临时本地 Go 工具只读取必要配置/凭据和摘要，
  选择一封邮件、在独立连接读取其当前 Seen，再调用真实 `Mail.SetRead` 写回同一状态，
  随后独立读取确认身份、Seen、Flagged 未改变，本地状态与服务器一致。
  输出仅为 `identity_confirmed`、`state_preserved=true`、`local_matches=true`、`success`，
  无真实地址、UID、主题、正文或凭据。没有批量改状态，临时工具源已删除。
- 开发版本已重启；22:50:55 WebView2 成功创建，22:51:19 NAVER 再次 `SYNC_COMPLETE`，
  schema 仍为 v5、10 条摘要和10 条正文；本轮没有迁移数据库。
- 最后补充 UI 文案回归，先复现自动已读提示仍包含“目标文件夹”，再收敛为通用安全条件提示。
  正在重新执行最终完整门禁（`desktop/.task/t68-verify-final.log`），不以之前结果代替。
- 真实验证覆盖协议/服务层幂等写回；自动展示触发与失败后工具栏重试由前端测试覆盖，
  未操作用户真实邮件进行“未读→已读”的状态切换，也未宣称跨所有账号或原子 UID 保证。
  当前环境 CGO 关闭且无 GCC，未运行 race；未验收 macOS WebView。
- 最终 `go -C desktop tool wails3 task verify` 全部通过：前端 71 文件／636 测试，
  包含新增“自动已读不支持提示不含目标文件夹且不泄漏底层错误”回归；全部 Go 检查、
  测试与 Windows 构建同样通过。最终日志 `desktop/.task/t68-verify-final.log`。
- ADR-0010、账号向导、数据库语义文档、变更日志与任务索引已更新。
- `git diff --check`、本轮修改文件 UTF-8 无 BOM 与文档相对链接检查通过；
  开发窗口已切到前台，9245 开发服务 HTTP 200，临时核验工具已删除。

## Git 与交付
- 未授权提交/推送，未提交，保留 active 待评审；不归档。
- 既有工作树修改保留，混合文件未擅自暂存；开发版已重新运行，等待用户实际界面确认。

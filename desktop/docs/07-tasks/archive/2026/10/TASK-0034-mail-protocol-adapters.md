# TASK-0034 邮件协议与 MIME 适配

> 状态：已完成 | 完成：2026-10-28 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P0
> 关联：TASK-0032 / FR-01 / FR-02 / FR-03

## 范围与计划

- 比较并锁定维护中的 IMAP/MIME 库，SMTP 优先标准库；在平台边界封装真实 TLS 认证、读取和发送。
- 禁止跳过证书校验和明文认证降级；连接、命令、响应与 MIME 解码有超时和资源上限。
- 返回稳定错误码，不向 UI/日志传播服务器原始响应、地址、口令或令牌。
- 用本地 TLS 测试服务器验证认证成功/失败、取消、邮件获取及 SMTP 发送。
- OAuth 未配置注册客户端时必须明确提示，不假造可用能力。

## 验收

- [x] 本地真实 TLS 服务验证 IMAP 和 SMTP 登录，不是仅 TCP 连通。
- [x] Context/Deadline 关闭底层连接，私有连接由服务生命周期收尾。
- [x] MIME 文本限长、附件 sink 流式落盘，不执行 HTML；按整封读取而非逐附件远端 FETCH。
- [x] 测试只用 localhost 服务和 example.invalid 地址，不访问真实账号、不投递外部邮件。

## 实现与验证

采用稳定 IMAP v1 客户端 `go-imap v1.2.1` 和 `go-message v0.18.2`，SMTP 使用标准库；
以上用于本次用户明确要求的邮件能力，不引入框架。两者为 MIT，keyring 使用 MIT 且 Darwin
适配保留 Apache-2.0 来源声明；正式分发前仍需更新完整第三方许可清单。
源码审查后调整：v1 客户端没有向调用方开放 literal 上限且完整分配正文，
不适合不可信邮件输入；改锁定 `go-imap/v2 v2.0.0-beta.8`，使用流式 body 与 literal.Size 限制，
不使用 Collect 读取正文。接受预发布依赖的维护风险，必须用本地真实 TLS 服务验证；v1 直接依赖移除。
实际测试结果后填。

2026-10-28：计划把新增协议/钥匙串依赖的原始许可证保存到现有 public/third-party-licenses，
保留 Darwin 适配的 Apache-2.0 声明并随静态资源构建；不为 OmniMail 选择或更换项目许可证。
这些文件不代表所有传递依赖及资产的发行合规审计已经完成。

## 实际实现与验证（2026-10-28）

- `mailnet` 实现 TLS 1.2+、隐式 TLS/STARTTLS、IMAP 登录、ID、特殊文件夹、UID 搜索/头/正文，
  SMTP 标准库 PLAIN 认证和纯文本 DATA；不提供跳过证书验证的接口。
- 每连接总读取预算 64 MiB，MIME literal 40 MiB，正文 1 MiB，单附件 25 MiB；
  不展开动态或百万 UID 集合，错误只映射安全代码。SMTP DATA 不确定结果不自动重试。
- `go -C desktop test ./internal/mailnet` 通过：IMAP 两种 TLS、本地 SMTP 登录/发送、
  不可信证书拒绝、取消、MIME/安全文本；SMTP STARTTLS 已实现，但未单独做服务器夹具覆盖。
- `TestTLSAccountToDatabaseBodyAttachmentAndSend` 通过：真实 TLS 适配器→账号服务→SQLite→
  流式附件缓存→SMTP 投递的组合链路，只有凭据存储使用受控内存替身；OS 路径单独原生验证。
- 无服务商实测、OAuth 客户端、IDLE、完整 SMTP 认证机制兼容性或大规模性能验收。
  预发布 IMAP v2 是明确的维护风险，不把可编译等同于所有服务器兼容。

## Git

- 实现随 TASK-0032 集成提交 `9ea61c9c6460e9ed40548a193f17070e83ffd1fe`。
- 2026-10-28 用户授权本轮协议主路径提交与结案，验证与 SHA 已登记；未推送。
- 归档日期：2026-10-28。OAuth、IDLE 与服务商实测转 TASK-0037，不能视为完成。

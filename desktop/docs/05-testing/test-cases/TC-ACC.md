# TC-ACC 账号用例

> 状态：草稿 | 最后更新：2026-10-15 | 关联：[FEAT-0001](../../01-product/features/FEAT-0001-account-onboarding.md)

---

### TC-ACC-001 添加 Gmail 账号（预设自动填充）

- 级别：P0 | 状态：自动（`TestAccountCreate_PresetGmail`）
- 前置：无账号，本地假 IMAP 服务已启动
- 步骤：
  1. 输入 `user@gmail.com`，点"下一步"
  2. 观察服务器参数
  3. 输入密码并提交
- 预期：
  - IMAP 自动为 `imap.gmail.com:993 SSL`，SMTP 为 `smtp.gmail.com:465 SSL`
  - `Probe` 成功后落库，`credential_ref` 非空
  - 5s 内触发首次同步，账号状态变为 `syncing`

### TC-ACC-002 错误密码被拒绝且不落库

- 级别：P0 | 状态：自动（`TestAccountCreate_BadPassword`）
- 步骤：输入错误密码提交
- 预期：
  - 返回错误码 `AUTH_INVALID`，UI 停留第 2 步并清空密码框
  - `account` 表行数为 0；钥匙串无新增条目

### TC-ACC-003 连接超时

- 级别：P0 | 状态：自动（`TestProbe_Timeout`）
- 步骤：指向不可达主机 `TARGET_HOST:993`
- 预期：10s 内返回 `TIMEOUT`，UI 不冻结，可取消

### TC-ACC-004 服务商禁用 IMAP

- 级别：P1 | 状态：手动
- 前置：测试账号在服务商侧关闭 IMAP
- 预期：返回 `IMAP_DISABLED`，展示开启指引；不落库

### TC-ACC-005 移除账号并删除本地数据

- 级别：P0 | 状态：自动（`TestAccountRemove_Purge`）
- 前置：账号已同步 100 封邮件 + 5 个附件
- 步骤：移除账号，选择"删除本地数据"
- 预期：
  - `account`/`mail`/`mailbox`/`mail_fts` 中该账号行数为 0
  - 附件目录无残留（按 sha256 引用计数为 0）
  - 钥匙串条目被删除
  - 列表与未读数立即更新

### TC-ACC-006 移除账号但保留本地数据

- 级别：P1 | 状态：自动
- 预期：账号与凭据删除；邮件行标记 `orphaned`；统一收件箱不再显示；7 天后清理

### TC-ACC-007 停用账号

- 级别：P1 | 状态：自动
- 预期：停止同步与通知；不出现在统一收件箱；侧栏保留灰色状态；重新启用后从游标继续

### TC-ACC-008 凭据不落日志

- 级别：P0 | 状态：自动（`TestLogRedaction`）
- 步骤：以 `debug` 级别执行完整添加流程
- 预期：日志中无密码明文、无令牌明文；邮箱地址已脱敏

### TC-ACC-009 重复添加同一账号

- 级别：P2 | 状态：自动
- 预期：返回 `VALIDATION`，提示"该账号已存在"，不产生第二行

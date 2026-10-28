# TASK-0033 系统凭据存储

> 状态：待评审 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P0
> 关联：TASK-0032 / ADR-0004

## 范围与计划

- 复用 `domain.CredentialStore`，实现 Windows Credential Manager；其他平台不可用时明确失败，
  不落明文、不以固定密钥或假实现代替系统保护。
- 校验应用命名空间、大小、控制字符；系统错误不回显秘密。
- 账号失败补偿由服务层编排；OS 原生调用的取消边界需如实记录。
- 分步补充 fake 错误路径与受控临时条目的原生读写删除测试。

## 验收

- [x] Windows 主路径秘密实际受 OS 保护，随机条目的读取与删除已验证。
- [x] 非法引用、超限和调用前取消请求不调用底层 API。
- [x] 区分缺失与存储不可用，不回显 OS 诊断或秘密；具体拒绝访问原因不向 UI 透出。
- [x] DPAPI 降级和 macOS 实机能力未验收，界面/文档明确边界。

## 实现与验证

采用 `go-keyring v0.2.8` 适配 Credential Manager/Keychain，macOS 通过 security 的 stdin 传递秘密，
而非命令行参数；包装层限制大小，避免后端启动交互进程后才发现过长输入。
不可用时失败关闭，本轮不默默降级到文件。测试不得读取既有用户条目，
只能使用随机生成的本应用临时条目并清理。

## 实际验证（2026-10-28）

- `OMNIMAIL_TEST_NATIVE_KEYRING=1 go -C desktop test ./internal/platform -run TestNativeCredentialsRoundTrip -count=1 -v`：
  Windows 原生 Set/Get/Delete 通过，临时条目清理通过；没有读取任何既有用户条目。
- 普通单测覆盖命名空间、长度、取消、缺失条目和脱敏错误；未开启标志时跳过原生写入测试。
- macOS ARM64 后端测试包交叉编译通过，未实机运行。原生 API/Keychain 调用仅保证调用前取消，
  不宣称能中断 OS 正在进行的授权交互。不可用时不降级到明文或固定密钥文件。

## Git

前一轮未提交、待评审；2026-10-28 用户已授权随 TASK-0032 基础闭环提交并结案。
实际提交号产生后登记；未授权推送。DPAPI 与 macOS 未验收项转 TASK-0037，不能视为完成。

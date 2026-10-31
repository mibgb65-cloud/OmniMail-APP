# 邮件接入新增依赖与发布边界

> 更新：2026-10-28 | 关联：TASK-0032～0036

## 依赖

| 模块 | 当前版本 | 用途 |
| --- | --- | --- |
| github.com/emersion/go-imap/v2 | v2.0.0-beta.8 | 流式 IMAP 客户端、测试内存服务 |
| github.com/emersion/go-message | v0.18.2 | MIME/字符集解析 |
| github.com/zalando/go-keyring | v0.2.8 | Credential Manager / Keychain 主路径 |
| golang.org/x/net | v0.61.0（沿用已有版本，转直接依赖） | HTML 纯文本提取，不执行邮件 HTML |

SMTP 使用 Go 标准库。没有新增前端框架或更改 Wails 版本。
IMAP v2 是预发布依赖；版本已锁定，升级必须重跑真实 TLS 夹具和账号/缓存组合测试。

## 许可

三个模块的原始许可证及 keyring Darwin 来源的 Apache-2.0 文本已保存在：

- [go-imap-v2.txt](../../frontend/public/third-party-licenses/go-imap-v2.txt)
- [go-message.txt](../../frontend/public/third-party-licenses/go-message.txt)
- [go-keyring.txt](../../frontend/public/third-party-licenses/go-keyring.txt)
- [go-keyring-darwin-apache-2.0.txt](../../frontend/public/third-party-licenses/go-keyring-darwin-apache-2.0.txt)

这些文件随前端 public 静态资源构建。它们不改变 OmniMail 自有代码的许可，
也不代表传递模块、标准库、所有平台或资产的完整发行合规审计已经完成。

## 发布前未验收项

- 没有真实 Gmail、QQ、网易或自建服务器账号验收，只验证本地真实 TCP/TLS 服务与原生 Windows 凭据。
- 没有原生窗口输入真实账号的完整 E2E 或 macOS 实机验证。后端 macOS ARM64 交叉编译不等于运行通过。
- OAuth 需要合法注册客户端及回调配置，尚未提供授权流程，不借用其他项目的客户端 ID。
- 没有 IDLE、离线发件队列、草稿自动保存、发送附件、完整搜索或缓存 GC。
- SMTP 只确认服务器 DATA 接受，不承诺最终送达、送达回执或服务商已发送文件夹一定归档。
- DPAPI 降级未实现，系统凭据不可用时失败关闭。邮件缓存未加密，不能把凭据保护等同于内容加密。

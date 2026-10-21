# 平台能力层（platform）

> 状态：草稿 | 负责人：@arch-lead | 最后更新：2026-10-15
> 相关：[桌面端架构](README.md) · [FEAT-0006 通知与托盘](../../01-product/features/FEAT-0006-notification-tray.md)

---

## 1. 目标

把所有"跟操作系统打交道"的代码收敛到 `internal/platform/`，用统一接口暴露给 service 层，
使业务逻辑保持平台无关，且便于在测试中用假实现替换。

## 2. 接口清单

```go
package platform

type Notifier interface {
    Notify(n Notification) error
    RequestPermission() (bool, error)   // macOS 需要
}

type Tray interface {
    SetUnread(count int)
    SetTooltip(s string)
    SetMenu(items []MenuItem, onClick func(id string))
    Destroy()
}

type Hotkey interface {
    Register(accel string, fn func()) error   // 例："Ctrl+Shift+M"
    UnregisterAll()
}

type Autostart interface {
    Enable() error
    Disable() error
    IsEnabled() (bool, error)
}

type Keychain interface {
    Set(service, account string, secret []byte) error
    Get(service, account string) ([]byte, error)
    Delete(service, account string) error
}

type Shell interface {
    OpenExternal(url string) error      // 仅 http/https/mailto
    RevealInFolder(path string) error
    OpenDir(path string) error
}

type SystemInfo interface {
    OS() string            // windows | darwin
    AppVersion() string
    DataDir() string
    ScreenScale() float64
}
```

## 3. 平台实现矩阵

| 能力 | Windows | macOS | 实现要点 |
| --- | --- | --- | --- |
| 通知 | WinRT toast | UserNotifications | Windows 需 AppUserModelID，未签名时可能被抑制 |
| 托盘 | `systray`（Shell_NotifyIcon） | NSStatusItem | 图标用 16/32px PNG，支持深色模式模板图（macOS） |
| 快捷键 | `RegisterHotKey` | `RegisterEventHotKey` | 冲突时返回错误并提示用户换键 |
| 自启动 | `HKCU\...\Run` | `~/Library/LaunchAgents/*.plist` | 卸载时清理 |
| 钥匙串 | Credential Manager（`wincred`） | Keychain（Security.framework） | 凭据长度上限：Windows 2560 字节，需分块或改用 DPAPI |
| 打开链接 | `ShellExecute` | `open` | 白名单协议 |
| 深链接注册 | 注册表 `HKCR\omnimail` | `CFBundleURLTypes` | 安装时写入 |

> Windows 凭据管理器单条 blob 上限约 2560 字节，OAuth 令牌超出时改为 DPAPI 加密后存文件
> （路径 `%APPDATA%/OmniMail/secrets/`，ACL 限当前用户）。见 [ADR-0004](../adr/ADR-0004-credential-storage.md)。

## 4. 构建标签

```
internal/platform/
├── platform.go            // 接口与通用类型
├── notify_windows.go      //go:build windows
├── notify_darwin.go       //go:build darwin
├── tray_windows.go
├── tray_darwin.go
├── hotkey_windows.go
├── hotkey_darwin.go
├── keychain_windows.go
├── keychain_darwin.go
└── fake/                  // 测试替身
    └── fake.go
```

- 每对平台实现必须共享同一份接口契约测试（`platform/platform_contract_test.go`），
  在 CI 的两个平台上分别跑。
- 未实现的平台返回 `ErrUnsupported`，而不是 panic。

## 5. 失败降级

| 能力失败 | 降级行为 |
| --- | --- |
| 通知被系统禁用 | 仅更新托盘未读数，设置页显示"系统通知已关闭，点击打开设置" |
| 快捷键注册冲突 | 提示用户改键，保留默认值记录为"未生效" |
| 托盘创建失败 | 关闭窗口即退出，UI 提示原因 |
| 钥匙串不可用 | 退回 DPAPI/文件密钥库，明确告知用户安全性降低 |

## 6. 测试策略

- 单元：`fake` 实现验证 service 的调用行为（是否发通知、是否注册快捷键）。
- 平台契约测试：同一套断言跑两个 OS 实现（CI 矩阵）。
- 冒烟（手工，每次发布前）：
  - [ ] 通知点击跳转正确
  - [ ] 托盘图标双主题下可见
  - [ ] 快捷键在无焦点窗口时生效
  - [ ] 重启系统后自启动生效
  - [ ] 移除账号后钥匙串条目消失

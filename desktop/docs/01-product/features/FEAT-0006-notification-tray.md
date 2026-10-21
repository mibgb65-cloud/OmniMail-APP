# FEAT-0006 通知与托盘

> 状态：草稿 | 负责人：@frontend-lead | 最后更新：2026-10-15
> 需求：[FR-05-1/2/3/6](../requirements.md) | 相关：[平台层](../../02-architecture/desktop/platform.md)

---

## 1. 背景与目标

桌面客户端的价值一半在"不用打开就直到有新邮件"。通知必须**不打扰**：
可精确控制来源账号、关键词、时间段；点通知能直达邮件。

## 2. 用户故事

- 收到工作邮箱的新邮件时弹通知，个人邮箱不弹。
- 我在专注模式（免打扰时段）时不弹通知，但托盘图标显示未读数。
- 点击通知直接跳转到该邮件的详情，并自动标记已读。

## 3. 通知策略

```go
type NotificationPolicy struct {
    Enabled      bool     `json:"enabled"`
    AccountIDs   []string `json:"accountIds"`   // 空 = 全部
    OnlyImportant bool    `json:"onlyImportant"`// 星标发件人/包含关键词
    Keywords     []string `json:"keywords"`
    QuietHours   *TimeRange `json:"quietHours"` // "22:00"-"08:00"
    GroupWindow  int      `json:"groupWindow"`  // 秒，窗口内合并为一条汇总
}
```

- 合并：同一账号 60s 内多封 -> 一条"ACCOUNT_LABEL 收到 3 封新邮件"。
- 去重：同一 `message_id` 不重复通知。
- 自身发送回环（自己发给自己的抄送）不通知。

## 4. 平台实现

| 能力 | Windows | macOS |
| --- | --- | --- |
| 系统通知 | toast（需 AppUserModelID） | `UNUserNotificationCenter` |
| 托盘/菜单栏 | `systray` | `NSStatusItem` |
| 全局快捷键 | `RegisterHotKey` | `RegisterEventHotKey`（需辅助功能权限提示） |
| 开机自启 | 注册表 Run 键 | LaunchAgent plist |
| 单击托盘 | 显示/隐藏窗口；右键菜单 | 同 |

实现放在 `internal/platform/`，统一接口：

```go
type Notifier interface {
    Notify(n Notification) error
    OnActivate(func(mailID string))
}
type Tray interface {
    SetUnread(count int, tooltip string)
    SetMenu(items []TrayItem)
}
```

## 5. 托盘行为

- 关闭窗口 -> 最小化到托盘（设置项 `closeToTray`，默认 true）。
- 托盘菜单：显示主窗口 / 统一收件箱（N 未读）/ 撰写新邮件 / 立即同步 / 免打扰（开关）/ 退出。
- 退出前若有未保存草稿 -> 同步落盘后再退出。
- 单实例：第二次启动通过命名管道/本地 socket 通知已有实例聚焦（`app.SingleInstanceLock`）。

## 6. 验收标准

- [ ] 配置仅工作账号通知后，个人账号来信不弹。
- [ ] 免打扰时段内无通知，托盘未读数仍更新。
- [ ] 点击通知聚焦窗口并定位到对应邮件。
- [ ] 60s 内 3 封同账号来信合并为 1 条通知。
- [ ] Windows 11 与 macOS 14 上通知图标与名称正确（非 "Electron"/"unknown"）。
- [ ] 重复启动应用不产生第二个进程，已有窗口被聚焦。
- [ ] 退出后无残留进程。

## 7. 非目标

- v1 不做通知中心历史视图。
- v1 不做通知声音自定义（用系统默认）。

## 8. 风险与开放问题

- macOS 全局快捷键需要用户授予辅助功能权限，首次失败的引导文案需产品确认。
- Windows toast 在未签名安装包下可能被系统抑制——与发布签名方案联动（[06-release](../../06-release/)）。
- Linux 不在 v1 范围，接口保留以便后续接入。

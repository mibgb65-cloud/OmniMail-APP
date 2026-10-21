# Windows 构建与发布

> 状态：草稿 | 负责人：@release-manager | 最后更新：2026-10-15
> 相关：[构建总则](build.md) · [发布检查单](release-checklist.md)

---

## 1. 环境要求

| 项 | 要求 |
| --- | --- |
| 构建机 | Windows 10 1809+ / Windows 11（推荐 11 23H2） |
| Go | 1.22+ amd64 |
| Wails CLI | v2.8+ |
| WebView2 SDK | `wails doctor` 自动安装 |
| 签名工具 | Windows SDK 的 `signtool.exe` |
| 安装包工具 | NSIS 3.x（`makensis`）或 WiX Toolset 3.11 |

## 2. 构建

```powershell
cd desktop
wails build -clean -platform windows/amd64 `
  -ldflags "-s -w -X main.Version=$((git describe --tags).Trim())"

# 产物
desktop\build\bin\OmniMail.exe
```

### 嵌入清单与版本信息

`desktop/build/windows/info.json`：

```json
{
  "fixed": {
    "file_version": "1.0.0.0",
    "product_version": "1.0.0.0"
  },
  "info": {
    "0000": "OmniMail",
    "0001": "OmniMail - 本地优先的多账号邮件客户端",
    "0002": "1.0.0",
    "0003": "COPYRIGHT_YEAR OmniMail",
    "0004": "OmniMail",
    "0005": "OmniMail desktop mail client",
    "0006": "",
    "0007": ""
  }
}
```

`file_version` 为四段式，由脚本从语义版本生成（`X.Y.Z` → `X.Y.Z.0`）。

## 3. 图标与托盘

- `desktop/build/appicon.png`（1024×1024）→ 构建时生成多尺寸 ico。
- 托盘：`build/tray-light.png`（16/32px，深色图标，用于浅色任务栏）与 `tray-dark.png`。

## 4. 代码签名（Authenticode）

```powershell
$exe = "desktop\build\bin\OmniMail.exe"
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
  /n "COMPANY_NAME" $exe

signtool verify /pa /v $exe
```

- 证书类型：EV Code Signing（推荐，可减少 SmartScreen 警告）。
- 时间戳服务必须使用（否则签名随证书过期失效）。
- 签名后再打包安装包；安装包本身也需要签名。

## 5. 安装包

### NSIS（推荐，体积小）

```nsi
; build/windows/installer.nsi（要点片段）
!define APP_NAME "OmniMail"
!define APP_VERSION "VERSION"
!define APP_EXE "OmniMail.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\OmniMail"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "..\bin\OmniMail-${APP_VERSION}-windows-amd64.exe"
InstallDir "$LOCALAPPDATA\Programs\OmniMail"
RequestExecutionLevel user           ; 免管理员

Section "Install"
  SetOutPath "$INSTDIR"
  File "..\bin\${APP_EXE}"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
SectionEnd
```

```powershell
makensis build\windows\installer.nsi
```

### WebView2 依赖

- Win11 与多数 Win10 已内置 WebView2。
- 缺失时应用内提示并提供引导链接；安装包可选捆绑 `MicrosoftEdgeWebView2Setup.exe`
  （会增加约 1.5-2MB，或在线引导）。
- 决策记录见 [backlog](../07-tasks/backlog.md) 中的"WebView2 分发策略"。

## 6. 免安装版

```powershell
Compress-Archive -Path desktop\build\bin\OmniMail.exe -DestinationPath `
  OmniMail-VERSION-windows-amd64-portable.zip
```

免安装版同样需签名，否则 SmartScreen 会拦截。

## 7. 冒烟检查（Windows）

- [ ] 双击安装，无管理员提权
- [ ] 首次启动创建数据目录 `%APPDATA%\OmniMail`
- [ ] 添加账号成功、收到邮件
- [ ] 系统通知弹出（含应用名，不是 "unknown"）
- [ ] 关闭窗口后托盘常驻，左键恢复窗口
- [ ] `Ctrl+Shift+M` 全局快捷键唤起
- [ ] 卸载后本地数据目录保留（询问用户是否删除）
- [ ] `signtool verify` 通过

## 8. 疑难

| 现象 | 处理 |
| --- | --- |
| 安装后通知不显示 | 检查 AUMID 是否设置；未签名包可能被系统抑制 |
| 托盘图标缺失 | 使用 16/32px 双尺寸 PNG，避免超大图 |
| 中文显示为方块 | 应用内字体回退缺失；确认 UI 使用系统字体栈（`Segoe UI`/`Microsoft YaHei`） |
| 杀软误报 | 签名；向厂商提交误报申诉；提供哈希 |
| WebView2 加载失败 | 检查系统 WebView2 版本，必要时要求用户升级 |

# Windows x64 安装与发布

> TASK-0083 · 2026-11-01 · 当前用户安装链路；应用内自动更新尚未启用

## 范围与工具

- 当前工程使用 Wails v3。安装器为 **Inno Setup 6.7.0**，仅 Windows x64、当前用户，
  `PrivilegesRequired=lowest`，不请求提权。不提供 ARM64、便携版 ZIP 或其他平台安装包。
- 普通 `build` / `verify` 仍生成开发独立程序，不签名、不发布；`verify` 额外覆盖 `cmd/` 的格式、vet 和测试。
- 安装器先选择简体中文或英语，再选择独立数据目录和程序目录；桌面快捷方式默认勾选，
  安装后运行默认关闭，不注册登录启动。安装记录和卸载记录仅写 HKCU。
- 数据目录浏览启用 Inno 原生“新建文件夹”，使用系统语言默认名称，可在选择窗口内创建再选择；
  不自动在所选路径后追加目录，取消浏览不修改已填路径。
  程序目录也关闭浏览时自动追加目录名，以显示原生新建按钮；默认完整安装路径不变。
- 生产元数据使用 `Software\OmniMail\Installation`，开发安装使用
  `Software\OmniMail-Development\Installation`，程序目录/AppId/登录启动项亦独立。
  开发运行留下的 `Software\OmniMail\OmniMailDesktop` 等通用子键不是生产安装标记，不会触发升级。
  只有匹配对应产品 AppId 的卸载记录，才允许兼容读取早期候选的父键安装元数据；
  有真实安装标记但路径丢失仍失败，不重新创建空数据目录。
- 数据含数据库、附件、日志、翻译缓存、设置及 WebView profile。原始数据目录不可用时失败，
  不静默回退到 AppData。程序/数据不能互相包含；拒绝网络、根目录、路径穿越、
  ADS、尾随空格/点、重解析目录及非固定本地盘。
- 程序与升级助手的文件名由 `installer.iss` 中的 `MainExe`／`HelperExe` 定义统一，
  可用 ISCC `/DMainExe=…` 覆盖，仅用于隔离探针：探针会安装并结束同名的 `OmniMailProbe.exe`，
  不会结束用户正在运行的正式实例。
- 用户显式选择系统盘时二次确认；静默首次安装若确需系统盘，必须明确指定 `/ALLOWC=1`。
  此参数只代表本次安装允许系统盘，不放宽其他路径校验。
- 覆盖升级保留原程序/数据位置、安装语言、快捷方式选择；拒绝降级和借升级迁移程序目录。
  卸载默认保留数据，不递归删除用户数据。旧独立版数据不会自动搬迁，迁移需另行备份和授权。
- 运行中的实例会锁住 `{app}` 里的 `OmniMail.exe`，直接复制会报
  `DeleteFile 失败：错误代码 5，拒绝访问`。安装前因此先执行：
  1. `taskkill /IM` 请求正常退出（偏好为“退出”的实例会干净结束），等待至多 3 秒；
  2. 托盘常驻或“关闭时询问”偏好不会响应正常关闭，随后 `taskkill /F /IM` 强制结束主程序和升级助手；
  3. 复查仍存在同名进程时，安装前中止并提示“无法自动关闭…未改动任何文件”，不进复制阶段。
  同时设置 `CloseApplications=force` 作为 Restart Manager 兜底。升级时若确实关闭过实例，
  完成页默认勾选“安装完成后启动”，让用户回到原状态；强制结束可能丢失未发送的撰写内容，
  因为当前版本不持久化草稿。卸载同样先结束运行实例再删除程序文件。
- 系统凭据库、注册表、WebView2 Runtime 和 Windows/安装器临时文件不属于可搬移的大数据，
  不能承诺系统盘零写入。当前不打包或自动安装缺失的 WebView2 Runtime。

### 固定来源

编译器来自上游 [6.7.0 Release](https://github.com/jrsoftware/issrc/releases/tag/is-6_7_0)，
`innosetup-6.7.0.exe` SHA-256：

```text
f45c7d68d1e660cf13877ec36738a5179ce72a33414f9959d35e99b68c52a697
```

CI 下载后先核对哈希，安装到 runner 临时目录；脚本编译期也校验 `VER=6.7.0`。
仓库内 `build/windows/ChineseSimplified.isl` 取自该 tag 的上游用户贡献语言文件，
blob `d6a11c4490de07dad443ade668289fc954dfa1ed`，保留译者声明，转换为 UTF-8 无 BOM，
本地 SHA-256 为 `7d544b9bb1d142cfa11f2e5d3cc8abe2e55f8e066c5124e3772675aa236e1278`。
不假定 Inno 默认安装附带简体中文。

## 本地开发安装包

仓库根目录执行（需已安装锁定编译器；这**不是正式发布**）：

```powershell
./desktop/scripts/package-windows.ps1 -Version 0.1.0 `
  -NotesFile desktop/docs/08-history/changelog.md -AllowUnsignedDevelopment
```

可用 `-ISCC` 指向锁定编译器。版本的三个分段必须在 `0..65535` 内。
每次产物保存到独立的 `desktop/.task/release/<version>-<mode>-<随机标识>/`，
不删除或混入旧包；主程序、资源和签名清单由同一版本构建。

开发包名含 `-dev-unsigned`，程序版本含 `-dev`；使用独立 AppId、HKCU
`Software\OmniMail-Development\Installation` 和快捷方式，不覆盖正式安装。

正式签名打包要求 PowerShell 7：脚本以 `$PSHOME\pwsh.exe` 调用签名子进程，不混用
Windows PowerShell 5 的安全模块。本机没有安装 PowerShell 7 时，可使用官方
`PowerShell-7.6.9-win-x64.zip`（SHA-256
`ce7484804c0f0ad4dda10c958e71acdaf7eebfb22505c1b480f89e0e9f1da94d`）解压到
`%LOCALAPPDATA%\OmniMail\release-tools\`，再用其中的 `pwsh.exe` 调用发布脚本；
这是用户级临时工具，不做系统级安装，也不改项目依赖。
开发默认数据目录为 `D:\OmniMail-Development\Data`（仅该盘存在时），生产为 `D:\OmniMail\Data`；
首次生产安装仍由用户选择独立目录，不自动复制或删除已有开发数据。
没有可信更新清单，禁止上传至正式 Release。默认构建输出不会覆盖正在运行的 `desktop/bin/OmniMail.exe`。

```powershell
./desktop/scripts/test-release-windows.ps1
# 将下面路径替换为上一步真实生成的开发安装包绝对路径：
./desktop/scripts/test-installer-windows.ps1 -Package '<开发安装包绝对路径>'
```

第二个命令会创建隔离的当前用户开发安装、验证非法路径拒绝和覆盖升级保留数据/语言，
最后调用该实例自己的卸载器。若已有开发版安装则拒绝覆盖。只使用合成数据，
不启动邮箱同步，不覆盖正式安装，保留 `.task/installer-smoke-*` 日志与合成数据。

## 正式签名材料与失败策略

正式调用省略 `-AllowUnsignedDevelopment`，必须预先以安全环境变量/Secrets 提供：

| 配置 | 位置与要求 |
| --- | --- |
| `WINDOWS_SIGN_CERT_PFX_BASE64` | GitHub Secret；只含一个带私钥签名证书的 PFX 的 Base64，CN 为 OmniMail，明确有代码签名 EKU |
| `WINDOWS_SIGN_CERT_PASSWORD` | GitHub Secret；PFX 密码 |
| `UPDATE_MANIFEST_PRIVATE_KEY` | GitHub Secret；Ed25519 32 字节种子或正确 64 字节私钥的 Base64 |
| `UPDATE_PUBLIC_KEY` | GitHub Variable；匹配的 32 字节 Ed25519 公钥 Base64 |

不得将私钥、PFX、密码或 Secret 值写入仓库、发布附件、命令参数、说明或日志。
普通打包不自动生成或轮换这些材料，初始化需明确授权；不在开发机、CI 或安装用户电脑中安装根证书。
签名器使用受限 ACL 临时文件、临时个人证书存储，以指纹选择证书，不将 PFX 密码传给 signtool；
结束清理本轮导入和临时材料。签名专用环境不得预存相同指纹的个人证书。
签名与系统信任是两件事：自签名包不要求 Windows 信任其根。
本地与 CI 均不导入 Root/TrustedPublisher，也不要求用户安装公开证书。
使用 WinVerifyTrust 校验文件，仅对本次预期自签身份允许精确的 `CERT_E_UNTRUSTEDROOT`；
缺少签名、散列不匹配、其他验证错误、签名指纹不符或无时间戳仍中止。

依次签名主程序、更新助手、卸载器和安装包，要求 SHA-256、时间戳、
实际签名、文件完整性及预期证书指纹。任一步失败立即终止，没有 unsigned fallback。
自签名不等于 Windows 公信任，仍可能出现 SmartScreen/未知发布者警告。

安装包再生成：

- `update-windows-amd64.json`：固定仓库/平台/架构/文件名、大小、SHA-256 与当前版本说明；
- `update-windows-amd64.sig`：带域分隔前缀的 Ed25519 签名，写出前以公钥回验；
- `SHA256SUMS.txt` 和 `RELEASE_NOTES.txt`。

这些文件定义未来自动更新的可信契约；存在签名清单不代表应用内更新已启用。

## GitHub tag 流水线

配置在 `.github/workflows/release-windows.yml`。需由维护者**另行授权推送 tag** 才会运行：

1. 只接受 `vMAJOR.MINOR.PATCH`，tag 提交须在 `origin/main` 历史，仓库须匹配固定仓库。
2. 检查同版本 Release（包括 draft）不存在；GitHub 网络/鉴权失败不能当成“不存在”。
3. `npm ci`、完整 `verify`、检查生成绑定未改变已打 tag 的源码、发布脚本拒绝测试。
4. 下载校验固定编译器，开发隔离包的真实安装/升级/卸载冒烟。
5. 从 `desktop/docs/06-release/notes/vX.Y.Z.md` 读取**本次版本**说明，不用整个历史日志冒充发布说明。
6. 材料齐全才构建和签名正式包，生成并回验签名清单。
7. 只上传明确的五个正式产物，先建 draft，全部上传成功后再公开；不覆盖既有版本。

若上传中断，可能留下未公开 draft，须人工检查后处置，不自动删除后重发。
代码本身不配置 Secrets、不创建证书、不推送 tag、不自动授权发布。
尚未运行真实 GitHub workflow 或真实签名时，不能宣称 CI / 正式发布验收通过。

## 后续边界

应用内自动检查/下载、设置开关、通知卡片、发送/草稿保护和“重启并更新”仍需继续完成。
现有 updater 后端/助手为未启用预备代码：不注册更新桥接、不启动后台调度；
不能以开发环境或浏览器预览证明真实签名更新端到端通过。完整目标见
[更新系统设计](update-system-design.md)。

## 已授权的本地签名材料保管

`scripts/release-signing.ps1` 使用固定仓库 `mibgb65-cloud/OmniMail-APP`：

```powershell
# 生成一次，已有完整材料时复用；遇到未完成目录拒绝覆盖，不自动轮换信任身份。
./desktop/scripts/release-signing.ps1 -Action Initialize
# 明确要求配置 GitHub 时才执行；三项 Secrets 和一项公开公钥 Variable。
./desktop/scripts/release-signing.ps1 -Action ConfigureGitHub
# 从本机加密材料临时加载进程环境，正式签名打包；默认不运行测试/verify。
./desktop/scripts/release-signing.ps1 -Action Package -Version 0.0.1
```

- 材料保存在 `%LOCALAPPDATA%\OmniMail\release-signing\mibgb65-cloud-OmniMail-APP`，
  目录 ACL 仅授予当前用户，PFX/密码和 Ed25519 种子采用 Windows DPAPI CurrentUser 加密。
  `metadata.json` 与 `github-receipt.json` 仅含公开身份与每项配置成功回执；不得提交材料目录。
- Go `cmd/release-key` 直接将种子 DPAPI 加密写入独占创建的文件，标准输出只有公钥。
  证书由 .NET 在内存生成，RSA-3072、SHA-256、代码签名 EKU、三年有效期，无长期 Root/My 导入。
- 上传通过已登录 `gh` 的匿名标准输入，不把秘密放入命令参数、dotenv、明文文件或日志。
  未知远端同名配置拒绝覆盖；部分失败保留成功回执，先核对远端再恢复，不盲目覆盖/轮换。
- GitHub Secrets 不可回读，本地打包直接使用同一份本机加密材料，结束恢复进程环境。
  临时导入 My 的签名证书及对应私钥、PFX 临时文件都会尝试清理；不会添加根信任。
  清理失败同样终止打包，不自动弱化签名要求。
- 本地 Package 仅加载签名材料并执行打包，不触发根证书导入确认或改变系统信任。
  DPAPI 文件不能直接在另一台机器/另一个 Windows 用户下恢复；换机、证书续期与密钥轮换
  必须另行规划安全迁移，不能直接重新生成后覆盖远端更新公钥。
- 本机无系统 Windows SDK 时，Package 会先用 `install-signing-tools.ps1` 从 NuGet 官方源
  获取固定 `Microsoft.Windows.SDK.BuildTools 10.0.26100.3916`（22,500,671 字节），
  SHA-512 Base64 为 `PcpU7O/npzZoFrvDdmjopbNYjJGLXhZMuu577aK/i1WPyDCD/gLaZNPJcBGB9+3KCX8LUbjL5nemSaKWdmgDMg==`。
  同时核对 NuGet 包签名和 signtool 的有效微软代码签名，在仓库外当前用户
  `%LOCALAPPDATA%\OmniMail\release-tools` 展开，不安装系统级 SDK，不改项目依赖。
  通过临时 `OMNIMAIL_SIGNTOOL` 路径传给签名器/卸载器签名子进程，结束后恢复原环境。
- 正式卸载器签名会接收 Inno 的 `uninst.e32.tmp` / `uninst.e64.tmp`，
  仅对这些固定名字开放临时文件入口，所有目标都检查 MZ/PE 头和可执行标记。
  Inno 签名子进程复用当前 PowerShell 7 的绝对路径，避免混用 PowerShell 5 安全模块。
- 早期任务记录中关于临时/手工导入根证书的步骤已撤回，仅保留为历史；
  生成与安装自签名生产包均不需要安装根证书。Windows/SmartScreen 警告可以正常保留。

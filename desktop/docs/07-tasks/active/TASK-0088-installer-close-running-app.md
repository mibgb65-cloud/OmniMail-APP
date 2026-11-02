# TASK-0088 安装与卸载自动关闭运行中的 OmniMail

> 状态：已完成
> 负责人：@Codex | 创建：2026-11-02 | 优先级：P1
> 实现提交：`05a669e441c74d4642d5935770e050126d57c10a`（未推送）

## 需求与现象
用户在 0.0.1 安装 0.0.2 时弹出 Inno 错误：`尝试替换现有文件时出错：DeleteFile 失败；错误代码 5。
拒绝访问。` 目标为 `E:\OmniMail\OmniMail.exe`。用户要求：软件在运行时安装器应自动关闭它再更新。

根因：Windows 加载器以仅共享读取的方式持有正在运行的 EXE，安装器复制阶段无法删除/替换；
`installer.iss` 当时为 `CloseApplications=no`，也没有主动结束进程的逻辑。

## 范围
- 只改安装器脚本的“关闭运行实例”与相应的完成页默认勾选，以及文件名定义收敛。
- 不改安装路径校验、数据目录校验、版本/降级规则、安装身份、签名链路、应用运行逻辑。

## 方案与取舍
- 安装前（`PrepareToInstall`，在文件复制之前）执行：`taskkill /IM` 请求正常退出 →
  等待至多 3 秒 → `taskkill /F /IM` 强制结束 → 再探一次（返回 128 表示已无同名进程）。
  主程序与升级助手都要结束。
- 为什么不能只依赖“正常关闭”：应用支持“关闭时询问/后台托盘”偏好，`WM_CLOSE` 会被拦截，
  安装器不能等在模态框上；用户点击安装即代表同意更新，强制结束是可预期的结果。
- 为什么仍保留 `CloseApplications=force`：Restart Manager 按文件路径精确识别占用者，
  作为遗漏进程（例如其他路径下同名进程）之外的兜底；不启用 `RestartApplications`。
- 全部结束后仍检测到同名进程时，安装前返回本地化提示并中止，而不是等到复制阶段抛
  `DeleteFile`；提示明确“未改动任何文件”。
- 卸载走同一套逻辑（`CurUninstallStepChanged` 的 `usUninstall`），避免卸载时同样卡在占用。
- 升级时若确实关闭过实例，完成页默认勾选“安装完成后启动”。

## 验收
- [x] 运行中覆盖安装不再出现文件占用错误，程序文件被真正替换。
- [x] 托盘/后台与“关闭时询问”偏好下也能自动结束。
- [x] 无法结束时在复制前中止并给出可操作提示。
- [x] 卸载会先结束运行实例，用户数据默认保留。
- [x] 隔离探针验证不影响其他正在运行的 OmniMail 实例。

## 实现
- `desktop/build/windows/installer.iss`：
  - 新增 `MainExe`／`HelperExe` 定义（`#ifndef` 可被 `/D` 覆盖），`[Files]`、`[Icons]`、
    `[Run]`、`UninstallDisplayIcon` 与代码全部改用定义，避免文件名两处漂移。
  - 新增 `StopImage`／`CloseRunningInstances` 与 `ClosedRunningInstance` 标志；
    `PrepareToInstall` 末尾调用，失败返回新增文案 `CloseFailed`（中英）。
  - `CurPageChanged(wpFinished)`：仅在确实关闭过实例且非静默时勾选启动项。
  - `CloseApplications=force`（原为 `no`），`RestartApplications=no` 不变。
  - 卸载步骤在删除文件前调用相同的结束逻辑。
- 文案：`chinesesimp.CloseFailed`／`english.CloseFailed`。
- 说明文档：[windows-installer.md](../06-release/windows-installer.md) 补充关闭流程、
  强制结束的取舍与探针覆盖方式。

## 验证记录（2026-11-02）
| 命令/核对 | 实际结果 |
| --- | --- |
| 探针编译（ISCC，`/DMainExe=OmniMailProbe.exe`，开发包） | 通过；用于隔离复现，不影响正式实例 |
| `.task/t88-installer-close-test.ps1` 首次静默安装 | 退出码 0，安装文件哈希与源一致 |
| 启动已安装的 `OmniMailProbe.exe`（持有自身 EXE）后覆盖安装 | 退出码 0；运行实例被自动结束；安装后哈希等于新源（证明文件真被替换）；日志无 `DeleteFile failed` |
| 同一轮核对用户正在运行的正式实例（`E:\OmniMail\OmniMail.exe`） | 未被结束，无附带影响 |
| 运行中静默卸载 | 退出码 0；实例被结束；EXE 被移除；日志无占用错误 |
| 正式 0.0.2 重打包（`release-signing.ps1 -Action Package -Version 0.0.2`） | 退出码 0；安装包 9,256,904 字节，SHA-256 `cbb79cdf67e10d8171ce9a462d5ff121cb5d48176a5bcef0acc70c7cb088a1f2`，签名与清单校验见 TASK-0083 |

未执行：在用户真实生产安装上直接跑覆盖升级（探针已等价复现运行实例被锁的场景）；
未推送 tag、未创建 GitHub Release。强制结束可能丢失未发送的撰写内容，因为当前不持久化草稿。

## Git 与交付
实现提交 `05a669e`（父提交 `2395fbb`）；随后以同版本 0.0.2 重打包，
交付副本 `desktop/bin/releases/v0.0.2-close-app/`；文档提交另行登记。未推送。

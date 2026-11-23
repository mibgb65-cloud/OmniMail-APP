# TASK-20261123-005：按版本号创建独立发布与二进制子目录并输出对应版本 EXE

## 状态
Completed

## 原始需求
打包不同版本时需要创建对应版本名的文件夹，并在文件夹中生成对应的版本 `.exe` 文件，避免多版本混放或覆盖。

## 实际改动
1. `desktop/build/windows/package-windows.ps1`（177 行）：
   - 发布产物按版本号自动创建独立目录 `dist/release/<Version>/`，并在该版本文件夹下生成：
     - `OmniMail-Setup-<Version>-windows-amd64.exe`（NSIS 交互式安装向导 `.exe`）
     - `OmniMail-<Version>-windows-amd64.exe`（对应版本的单文件免安装可执行 `.exe`）
     - `OmniMail-Portable-<Version>-windows-amd64.zip`（便携压缩包）
     - `SHA256SUMS.txt`（该版本目录全部产物的 SHA-256 校验值）
   - 生产编译中间二进制同步按版本号隔离至 `desktop/bin/<Version>/OmniMail-<Version>.exe`，多版本互不覆盖，也不覆盖开发态 `desktop/bin/omnimail.exe`。
2. `desktop/build/windows/installer/omnimail.nsi`（192 行）：
   - 更新默认宏 `APP_BINARY` 与 `INSTALLER_OUT` 为带 `${APP_VERSION}` 版本文件夹的路径。
3. `docs/development/BUILD.md`：
   - 同步更新发版目录说明为 `dist/release/<Version>/` 与 `desktop/bin/<Version>/`。

## 验证结果
- 已重新跑通 `-Version v0.0.1` 与 `-Version v0.0.1.beta.1` 两套打包及 `task build`；
- 已核验 `dist/release/v0.0.1/`、`dist/release/v0.0.1.beta.1/` 均准确创建并包含各自版本命名的 `.exe` 文件。
- 未验证事项：后续由 [TASK-20261123-006](TASK-20261123-006-installer-only-release-output.md) 进一步收敛为仅保留 NSIS 可安装向导 `.exe`。
- 关联文档：[构建与发版打包](../../../development/BUILD.md)。
- Git 提交：实现提交 `c86e4d0`。

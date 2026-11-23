# TASK-20261123-006：精简发布目录为仅输出对应版本的 NSIS 可安装向导 EXE

## 状态
Completed

## 原始需求
用户明确不需要免安装便携版（Portable `.zip` / 独立免安装 `.exe`），要求在对应版本名的文件夹（`dist/release/<Version>/`）中仅生成可安装的 NSIS 安装包 `.exe`。

## 实际改动
1. `desktop/build/windows/package-windows.ps1`（147 行）：
   - 移除免安装便携版 `.zip` 与单文件免安装 `.exe` 输出逻辑；
   - Go 生产编译的临时主程序暂存于 `desktop/bin/.stage-<Version>/OmniMail.exe`，封装进 NSIS 安装向导后在 `finally` 中自动清理；
   - 每个版本文件夹 `dist/release/<Version>/` 下仅输出可安装的 `OmniMail-Setup-<Version>-windows-amd64.exe` 与其 `SHA256SUMS.txt`。
2. `Taskfile.yml` 与 `docs/development/BUILD.md`：
   - 同步更新任务说明与发版文档，去除便携版描述。

## 验证结果
- 已清理全部旧便携版产物，重新执行 `v0.0.1` 与 `v0.0.1.beta.1` 两轮构建；
- `dist/release/v0.0.1/` 与 `dist/release/v0.0.1.beta.1/` 均仅包含对应版本的 NSIS 可安装向导 `.exe` 与 `SHA256SUMS.txt`。
- 未验证事项：无。
- 关联文档：[构建与发版打包](../../../development/BUILD.md)、[产品范围](../../../product/PRD.md)。
- Git 提交：实现提交 `c86e4d0`。

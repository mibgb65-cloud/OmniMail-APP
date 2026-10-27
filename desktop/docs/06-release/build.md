# 构建与发布总则

> 状态：草稿 | 负责人：@release-manager | 最后更新：2026-10-25
> 相关：[Windows](windows.md) · [macOS](macos.md) · [发布检查单](release-checklist.md) · [版本号规范](../00-guidelines/git-conventions.md#4-版本号semver)

---

## 0. 当前可执行构建

当前工程为 Wails v3 骨架，只实现当前平台独立可执行文件构建。在仓库根目录执行：

```powershell
cd desktop
go tool wails3 task setup
go tool wails3 task verify
go tool wails3 task build
go tool wails3 task run
```

产物为 `desktop/bin/OmniMail.exe`（Windows），或对应系统的 `desktop/bin/OmniMail`。构建任务重新生成绑定、构建前端，通过 `production` 标签嵌入静态资源，再注入提交号和构建时间；应用版本仍为 `0.1.0-dev`。

`verify` 先执行统一检查，再构建到 `desktop/.task/verify-bin/`，不覆盖正在运行的常规产物。
后续 `build` 才生成上文 `bin/` 程序供 `run` 使用；`check` 是不含构建的子集，不能替代完整门禁。

Windows 原生构建在本次环境验证，macOS 构建尚待验证。Windows 图标与静态版本资源已接入；安装包、签名、公证、Git tag 版本注入和多平台发布流水线仍未实现。

### Windows 图标与资源

`go tool wails3 task build`（含 `DEV=true`）在 Go 编译前调用 `windows:resources`，使用已锁定的 `go tool wails3 generate syso`：

- 图标来源：`frontend/public/brand/omnimail.ico`，16～256px 各图层均由统一的完整图标导出，不再混入简化版。
- 图标主源为同目录的 `omnimail.svg`，使用图标包的完整标准版，圆角外透明，不附加白色底座或白边。同目录的 `omnimail-256.png` 恢复为原包对应 PNG，不另外增加边距；该 PNG 也通过 Go embed 嵌入，作为原生窗口备用图标。
- 清单与文件信息：`build/windows/OmniMail.exe.manifest`、`build/windows/info.json`；采用普通用户权限和 Per-Monitor V2 DPI。静态资源版本为 `0.1.0.0`，展示版本为 `0.1.0-dev`，尚不从 Git tag 推导。
- 生成物：`wails_windows_<GOARCH>.syso`，由 `.gitignore` 排除，按目标架构被 Go 自动链接；非 Windows 主机构建跳过该任务。

可单独执行 `go tool wails3 task windows:resources` 验证资源生成。直接执行 `go build` 不会重新生成图标资源，完整图标验收应使用项目构建任务。

图标 PNG 更新后，在 `desktop/` 使用锁定版本的工具重新生成全部 Windows 尺寸：

```powershell
go tool wails3 generate icons -input frontend/public/brand/omnimail-256.png -windowsfilename frontend/public/brand/omnimail.ico -macfilename= -sizes 256,128,64,48,32,24,16
```

`-macfilename=` 明确不额外生成尚未接入的 macOS 图标；生成后的 ICO 随仓库保存，常规构建只负责将其链接进 EXE。

**下列章节是发布目标与历史 Wails v2 方案，不是当前可执行操作手册。** `wails build`、`wails.json` 与 `main.Version` 示例不适用于现有 v3 工程；发布前必须完成脚本适配及平台验证。

## 1. 构建流程

```
准备（版本号/变更日志） → 构建（per 平台） → 签名 → 打包 → 冒烟 → 发布 → 登记
```

## 2. 版本号与产物命名

- 版本号：`MAJOR.MINOR.PATCH`，来自 git tag `vX.Y.Z`。
- 产物命名：

```
OmniMail-<version>-windows-amd64.exe          # 安装包
OmniMail-<version>-windows-amd64-portable.zip # 免安装
OmniMail-<version>-macos-universal.dmg
OmniMail-<version>-macos-universal.zip        # 公证用
SHA256SUMS.txt                                # 校验和
```

## 3. 构建前检查

```bash
# 1. 工作区干净
git status --porcelain          # 必须为空

# 2. 当前提交是标签指向
git describe --tags --exact-match

# 3. 依赖锁一致
cd desktop && go mod verify
cd frontend && npm ci

# 4. 测试全绿
cd desktop && go test ./... && cd frontend && npm run test

# 5. 前端可生产构建
cd frontend && npm run build
```

## 4. 构建命令

```bash
# 后端嵌入前端产物后构建
cd desktop
wails build -clean -platform windows/amd64 -ldflags "-s -w -X main.Version=$(git describe --tags)"
wails build -clean -platform darwin/universal -ldflags "-s -w -X main.Version=$(git describe --tags)"
```

`wails.json` 关键配置：

```json
{
  "name": "OmniMail",
  "outputfilename": "OmniMail",
  "frontend:install": "npm ci",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": { "name": "OmniMail", "email": "TEAM_EMAIL" },
  "info": { "companyName": "OmniMail", "productName": "OmniMail" }
}
```

## 5. 构建矩阵

| 平台 | 架构 | 构建机 | 签名 |
| --- | --- | --- | --- |
| Windows | amd64 | Windows 11 + WebView2 SDK | Authenticode（EV 证书） |
| Windows | arm64 | 同（交叉编译可用） | 同上 |
| macOS | universal (arm64 + x86_64) | macOS 13+ | Developer ID + 公证 |

> Linux 不在 v1 范围。

## 6. 产物校验

| 检查 | 方法 |
| --- | --- |
| 体积 | Windows 安装包 ≤ 25MB；dmg ≤ 35MB |
| 版本字符串 | 应用内"关于"显示 `vX.Y.Z` 与 commit |
| 签名 | `signtool verify /pa` / `codesign -dv --verbose=4` |
| 冒烟 | 见 [发布检查单](release-checklist.md) |
| 校验和 | 生成 `SHA256SUMS.txt` 并随发布页提供 |

```bash
# 校验和
sha256sum OmniMail-* > SHA256SUMS.txt        # Linux/mac
Get-FileHash OmniMail-*,SHA256 | Format-List # Windows
```

## 7. 发布渠道

| 渠道 | 用途 | 可见性 |
| --- | --- | --- |
| GitHub Releases | 公开下载 + 变更日志 | 公开 |
| 内部测试目录 | 灰度版本 | 团队 |

发布流程：

1. 在 `master` 打标签 `vX.Y.Z`。
2. 构建各平台产物并签名。
3. 上传到 Releases，附 `CHANGELOG` 摘要与 `SHA256SUMS.txt`。
4. 更新 [changelog](../08-history/changelog.md) 与 [milestones](../08-history/milestones.md)。
5. 内部通知：版本、变更、已知问题、回滚方式。

## 8. 回滚

| 场景 | 动作 |
| --- | --- |
| 安装包有问题（启动失败） | 立即从 Releases 移除该版本，恢复上一版本为 latest |
| 已安装用户受影响 | 发布 PATCH 版本；在更新提示中说明 |
| 数据格式变更导致不兼容 | 提示用户从 `backups/pre-migration-vNNNN.db` 恢复（见 [迁移文档](../02-architecture/database/migrations.md)） |

## 9. 常见构建问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 前端改动没生效 | 资源已嵌入旧构建 | `wails build -clean` |
| 产物过大 | 未裁剪符号 | 加 `-ldflags "-s -w"` |
| 版本号未更新 | `-X main.Version` 未传 | 检查构建命令 |
| Windows 杀软误报 | 未签名 | 签名 + 提交误报申诉 |
| macOS 公证失败 | 未 `--options runtime` 或权限声明缺失 | 见 [macos.md](macos.md) |

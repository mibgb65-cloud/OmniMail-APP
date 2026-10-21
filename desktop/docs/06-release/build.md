# 构建与发布总则

> 状态：草稿 | 负责人：@release-manager | 最后更新：2026-10-15
> 相关：[Windows](windows.md) · [macOS](macos.md) · [发布检查单](release-checklist.md) · [版本号规范](../00-guidelines/git-conventions.md#4-版本号semver)

---

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

# 发布检查单

> 状态：草稿 | 负责人：@release-manager | 最后更新：2026-10-15
> 相关规定：[版本号](../00-guidelines/git-conventions.md#4-版本号semver) · [构建](build.md) · [测试策略](../05-testing/testing-strategy.md)

发布版本：`vX.Y.Z`　　负责人：`@xxx`　　日期：`YYYY-MM-DD`

---

## 1. 代码与文档

- [ ] `master` 上 `git status` 干净，标签 `vX.Y.Z` 已打并推送
- [ ] 分支无未合入的 P0/P1 修复
- [ ] [changelog](../08-history/changelog.md) 已更新（分类：新增/修复/变更/移除）
- [ ] 相关 `01-product/features` 文档状态更新为"已发布"
- [ ] `04-development/api` 与实现一致（逐条核对绑定方法）
- [ ] 数据库迁移文件已提交，[migrations](../02-architecture/database/migrations.md) 记录了版本
- [ ] ADR 中"待决策"项若已定案，状态更新

## 2. 质量门禁

- [ ] `go test ./... -race` 全绿
- [ ] `go vet ./...` 无告警
- [ ] 前端 `lint` + `typecheck` + `test` 全绿
- [ ] `service` 覆盖率 ≥ 75%，`domain` ≥ 90%
- [ ] 迁移测试：空库 + 逐级升级 + 幂等，三者通过
- [ ] 性能：启动 ≤ 1.5s，内存 ≤ 250MB，搜索 P95 ≤ 120ms
- [ ] 安全：XSS 用例集（TC-MAIL-005/006/008/011）全部通过
- [ ] 日志抽查：无密码、无令牌、无完整邮箱明文

## 3. 缺陷状态

- [ ] P0 缺陷：0
- [ ] P1 缺陷：0
- [ ] P2 缺陷：已评估并在 changelog "已知问题"中列出
- [ ] [bug-reports](../05-testing/bug-reports/README.md) 列表与实际一致

## 4. 构建产物

- [ ] Windows：`wails build -clean -platform windows/amd64` 成功
- [ ] Windows：安装包体积 ≤ 25MB
- [ ] Windows：`signtool verify /pa` 通过
- [ ] Windows：免安装版可运行
- [ ] macOS：`wails build -clean -platform darwin/universal` 成功
- [ ] macOS：`codesign --verify --deep --strict` 通过
- [ ] macOS：公证成功且 `stapler validate` 通过
- [ ] 生成 `SHA256SUMS.txt` 并核对
- [ ] 应用内"关于"显示正确版本与 commit

## 5. 功能冒烟（在干净系统 / 新用户配置下）

- [ ] 全新安装 → 首次启动无崩溃
- [ ] 添加 1 个账号 → 首次同步完成 → 列表有邮件
- [ ] 打开邮件 → 正文正确 → 远程图片默认阻止 → 可放行
- [ ] 撰写 → 保存草稿 → 关闭重开内容仍在 → 发送成功
- [ ] 断网 → 标记已读 → 恢复网络 → 服务器状态一致
- [ ] 搜索中文关键词有结果，高亮正确
- [ ] 切换深色主题，所有页面无低对比度区域
- [ ] 系统通知可点击跳转到对应邮件
- [ ] 托盘/菜单栏常驻与退出正常
- [ ] 全局快捷键唤起窗口
- [ ] 移除账号（含清除本地数据）后无残留文件

## 6. 升级路径

- [ ] 从上一版本（`vX.Y-1`）升级：数据保留、迁移成功、无重复邮件
- [ ] 跨 MINOR 升级的迁移说明已写入 changelog
- [ ] 备份机制在升级前自动触发（`pre-migration-vNNNN.db`）
- [ ] 回滚方案已明确（恢复备份 + 安装上一版本）

## 7. 发布动作

- [ ] 产物上传 Releases，附 release notes（面向用户的语言）
- [ ] 更新下载页/内部通知（版本、亮点、已知问题、回滚方式）
- [ ] 归档任务：[07-tasks/archive/2026/10](../07-tasks/archive/2026/10/)
- [ ] 更新 [milestones](../08-history/milestones.md)
- [ ] 发布后 48 小时观察：崩溃率、同步失败率、启动失败报告

## 8. 签署

| 角色 | 姓名 | 结果 | 日期 |
| --- | --- | --- | --- |
| 开发负责人 | | | |
| 测试负责人 | | | |
| 发布负责人 | | | |

> 任一项未勾选，不得发布；例外需发布负责人书面记录风险与缓解措施。

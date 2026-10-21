# 测试策略

> 状态：草稿 | 负责人：@qa-lead | 最后更新：2026-10-15
> 相关：[测试用例](test-cases/README.md) · [缺陷记录](bug-reports/README.md) · [发布检查单](../06-release/release-checklist.md)

---

## 1. 原则

1. **测试金字塔**：单元为主，集成覆盖跨层契约，E2E 只保关键路径。
2. **缺陷先写测试**：修复前先提交能复现失败的用例。
3. **不测实现细节**：测行为与契约（输入 -> 输出、状态变化），避免脆弱断言。
4. **快**：单元测试全量 < 60s；CI 上的集成测试 < 10 分钟。

## 2. 分层与工具

| 层 | 范围 | 工具 | 目标覆盖率 |
| --- | --- | --- | --- |
| 单元（Go） | domain、service（含 fake 仓储） | `testing` + `testify` | service ≥ 70%，domain ≥ 90% |
| 仓储（Go） | SQL、迁移、事务 | 真实 SQLite（`t.TempDir()`） | 关键路径 100% |
| 契约（Go） | bridge DTO、错误码映射 | `testing` | 每个方法 ≥ 1 条错误路径 |
| 协议（Go） | IMAP/SMTP 适配 | 本地 greenmail / MailHog | 覆盖 IDLE、重连、UIDVALIDITY |
| 组件（前端） | 组件状态与交互 | Vitest + Testing Library | 关键组件 ≥ 70% |
| E2E | 启动 → 添加账号 → 收发 → 搜索 | Wails 手动 + 脚本化冒烟 | 每次发布前 |

## 3. 必测场景矩阵

| 场景 | 层 | 优先级 |
| --- | --- | --- |
| 账号校验：正确/错误密码/超时/服务商禁用 IMAP | service | P0 |
| 邮件解析：纯文本 / HTML / multipart / base64 附件 / 中文编码 | smtp·parser | P0 |
| HTML 清洗：script、onerror、form、tracking pixel、data URI | security | P0 |
| 同步：首次全量、增量、UIDVALIDITY 变化、断线重连、限流退避 | service | P0 |
| 离线队列：标记/删除/移动 + 联网回写、幂等 | service | P0 |
| 草稿：自动保存节奏、版本冲突、进程被杀恢复 | service + 前端 | P0 |
| 发送：成功、临时失败重试、永久失败转草稿 | service | P0 |
| 搜索：中英文、语法、无结果、降级 | service | P1 |
| 列表：万条渲染、分页游标、事件增量 | 前端 | P1 |
| 迁移：空库、逐级升级、幂等 | 仓储 | P0 |
| 平台：通知、托盘、快捷键 | 手动冒烟 | P1 |

## 4. 测试数据

- 统一放 `internal/testdata/`：`mail/*.eml`（各类真实结构，脱敏）、`schema/schema_vN.db`。
- EML 样本分类：
  - `plain-zh.eml`、`html-only.eml`、`multipart-mixed-zh.eml`
  - `malicious-script.eml`、`malicious-form.eml`、`tracking-pixel.eml`
  - `huge-inline-20mb.eml`、`broken-charset.eml`、`rfc2047-subject.eml`
- 大账号数据集用生成器：`go run ./internal/testdata/gen --count 10000`。

## 5. 性能测试

| 项 | 方法 | 门槛 |
| --- | --- | --- |
| 启动时间 | 记录 `app_startup_ms` | ≤ 1.5s |
| 列表首屏（1 万封） | 页面加载到首行渲染 | ≤ 50ms |
| 搜索 P95 | 跑 200 次查询取分位 | ≤ 120ms |
| 内存（3 账号） | 稳定后 RSS | ≤ 250MB |
| 滚动帧率 | Chrome DevTools Performance | ≥ 55fps |

基准脚本：`desktop/scripts/bench.sh`（待建立，登记于 [backlog](../07-tasks/backlog.md)）。

## 6. 缺陷分级与响应

| 级别 | 定义 | 响应 |
| --- | --- | --- |
| P0 | 数据丢失、崩溃、无法启动、凭据泄露 | 立即修，阻断发布 |
| P1 | 主要功能不可用（无法收发/同步失败不恢复） | 当迭代修 |
| P2 | 功能可用但有明显缺陷/体验差 | 排入下个迭代 |
| P3 | 文案、样式细节 | 随版本处理 |

## 7. CI 流水线

```
PR:
  ├─ lint (gofmt, go vet, eslint, prettier check)
  ├─ go test ./... -race（linux/mac/windows 矩阵）
  ├─ frontend: typecheck + test + build
  └─ 文档链接检查（markdown 相对链接存在性）

nightly:
  ├─ 迁移全矩阵测试
  ├─ 性能基准 + 与基线比较（回退 > 10% 告警）
  └─ E2E 冒烟（Windows + macOS 构建产物）
```

## 8. 发布前必做

见 [06-release/release-checklist.md](../06-release/release-checklist.md)。核心三条：

1. P0/P1 缺陷清零。
2. 新增功能有对应测试用例（`TC-` 文档 + 自动化覆盖）。
3. 三平台手工冒烟通过（通知、托盘、快捷键、深色主题、中文渲染）。

## 9. 覆盖率报告

```bash
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out | tail -1
go tool cover -html=coverage.out -o coverage.html
```

```bash
cd frontend && npm run test -- --coverage
```

覆盖率下降超过 3 个百分点需在 PR 中说明。

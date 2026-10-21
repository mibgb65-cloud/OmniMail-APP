# TASK-0003 CI 流水线

> 状态：待开始
> 负责人：@devops | 创建：2026-10-15 | 预计：2 天 | 优先级：P0
> 关联：[测试策略](../../05-testing/testing-strategy.md#7-ci-流水线) · [TASK-0002](TASK-0002-project-skeleton.md)

## 目标

每次 PR 自动执行 lint / vet / test / build，三平台矩阵覆盖；失败即阻断合并。

## 范围

### 包含
- `.github/workflows/ci.yml`：`lint`、`test`（windows/macos/ubuntu）、`frontend` 三个 job
- `gofmt -l` 与 `go vet` 检查
- `go test ./... -race`
- 前端 `npm ci && npm run lint && npm run typecheck && npm run test && npm run build`
- 文档相对链接检查（markdown 链接目标存在性）
- 缓存：Go module、npm

### 不包含
- 发布签名流水线（M4）
- E2E 自动化（nightly 阶段）

## 实现步骤

1. [ ] 编写 `ci.yml` 三 job 骨架
2. [ ] 配置 Go/npm 缓存
3. [ ] 文档链接检查脚本（Node，扫描 `**/*.md` 的相对链接）
4. [ ] 分支保护：要求 `ci` 全绿才能合并
5. [ ] 失败样例验证（故意破坏一处，确认 CI 报红）

## 验收标准

- [ ] 正常 PR 上全部 job 在 10 分钟内完成
- [ ] 故意引入 `gofmt` 未格式化文件时 `lint` job 失败
- [ ] 故意让一个测试失败时 `test` job 失败
- [ ] 故意写坏文档链接时 `docs` 检查失败
- [ ] 缓存命中使重复运行 `test` job < 4 分钟

## 风险与依赖

- `-race` 在 Windows runner 上较慢，可能超时 -> 可先在 ubuntu 跑 race，其余跑普通测试。
- 文档链接检查对锚点（`#section`）不做校验，避免中文锚点误报。

## 验证记录

| 日期 | 验证内容 | 结果 |
| --- | --- | --- |
| — | — | — |

## 完成记录

- 提交：—
- 文档更新：—
- 归档日期：—

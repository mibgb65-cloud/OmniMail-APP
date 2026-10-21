# 代码规范

> 状态：已生效 | 最后更新：2026-10-15 | 适用：`desktop/internal/**` (Go)、`desktop/frontend/**` (TypeScript/React)

---

## 1. 通用原则

1. **先能读，再能跑**：命名 > 注释 > 结构 > 聪明技巧。
2. **函数单职责**：超过 60 行的 Go 函数、超过 120 行的 TSX 组件，必须拆分或说明理由。
3. **显式优于隐式**：禁止依赖全局可变状态、init() 副作用、隐式类型转换。
4. **错误必须被处理**：Go 不允许 `_ = err`（除明确标注 `//nolint:errcheck` 并有注释）；TS 不允许 `catch {}` 空块。
5. **不引入未评审依赖**：新增 go.mod / package.json 依赖需在 PR 中说明体积、许可证、维护活跃度。

---

## 2. Go 后端（`desktop/internal`）

### 2.1 目录与包设计

```
internal/
├── app/          # Wails 应用装配：生命周期、窗口、绑定注册
├── bridge/       # 暴露给前端的 Wails 绑定层（薄适配，不含业务逻辑）
├── config/       # 配置加载/校验/持久化
├── domain/       # 纯领域模型与接口定义（不 import 任何框架）
├── logger/       # 结构化日志封装
├── platform/     # 操作系统差异：通知、托盘、自启动、快捷键、凭据存储
├── repository/   # 存储实现（SQLite / 文件 / 系统钥匙串）
└── service/      # 业务用例编排
```

**依赖方向（单向，禁止反向）**：

```
app → bridge → service → repository → domain
                 ↘ config / logger / platform
```

- `domain` 不得 import `service`/`repository`/`bridge`。
- `repository` 接口定义在 `domain`，实现放 `repository`（依赖倒置）。
- `bridge` 只做参数转换 + 调用 service + 错误包装，**不写 if/else 业务分支**。

### 2.2 命名

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 包名 | 小写单词，无下划线，无复数 | `mailbox`, `credential` |
| 接口 | 名词或 `-er` | `AccountRepository`, `Notifier` |
| 构造函数 | `NewXxx` 返回具体类型或接口 | `NewMailService(...)` |
| 导出方法 | 动词开头 | `SyncAccount`, `MarkRead` |
| 错误变量 | `Err前缀` | `ErrAccountNotFound` |
| 上下文 | 参数名 `ctx`，永远第一个 | `func (s *Service) Sync(ctx context.Context, id string)` |

### 2.3 错误处理

```go
// domain/errors.go
var (
    ErrAccountNotFound = errors.New("account not found")
    ErrAuthExpired     = errors.New("auth expired")
)

// 包装：保留语义 + 上下文
if err != nil {
    return fmt.Errorf("sync account %s: %w", id, err)
}
```

- 跨层传递用 `%w` 包装，最外层用 `errors.Is/As` 判断。
- 面向用户的错误必须是**可行动文案**，不是堆栈：`账号授权已过期，请重新登录`。
- bridge 层统一把 error 转成前端可消费结构：

```go
type APIError struct {
    Code    string `json:"code"`    // AUTH_EXPIRED / NETWORK / VALIDATION ...
    Message string `json:"message"` // 中文用户文案
    Detail  string `json:"detail"`  // 诊断信息，仅日志与开发模式展示
}
```

### 2.4 并发

- 所有可能阻塞的 IO 方法必须接收 `ctx` 并检查 `ctx.Err()`。
- 由 service 持有 `sync.WaitGroup` / `errgroup`，禁止在 `repository` 内部起后台 goroutine。
- 共享状态用 `sync.RWMutex` 保护；channel 只用于任务分发，不用作锁。
- 定时/后台任务必须可取消，并在 `app.OnShutdown` 中等待退出。

### 2.5 日志

```go
logger.Ctx(ctx).Info("mailbox synced",
    "account_id", id, "new", n, "cost_ms", ms)
```

- 结构化键值对，键名 `snake_case`，禁止拼接字符串。
- **禁止**打印：令牌、密码、完整邮件正文、附件内容、用户邮箱明文（脱敏为 `a***@example.com`）。
- 级别：`debug` 开发细节 / `info` 状态变化 / `warn` 可恢复异常 / `error` 需人工介入。

### 2.6 测试

- 表驱动：`tests := []struct{ name string; in, want ... }`。
- 每个 service 至少有：正常路径 + 至少 2 条错误路径。
- repository 用 `t.TempDir()` + 真实 SQLite，不 mock 数据库。
- 覆盖率门槛：`service` ≥ 70%，`domain` ≥ 90%；`bridge` 由集成测试覆盖。

---

## 3. 前端（`desktop/frontend`）

### 3.1 分层

```
src/
├── app/          # 应用壳：路由、Provider、全局错误边界
├── features/     # 按业务域组织：accounts / mail / settings / compose ...
│   └── <feature>/{components,hooks,api,types,index.ts}
├── components/   # 跨域通用 UI（无业务语义）
├── lib/          # 工具函数、wails 客户端封装、日期/格式化
├── styles/       # tokens.css、globals.css
└── main.tsx
```

- 禁止 `features/a` 直接 import `features/b` 的内部文件，只能通过其 `index.ts`。
- 所有与 Go 的通信集中在 `lib/bridge/`，组件里**不允许**直接 `window.go.*`。

### 3.2 命名

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 组件文件 | PascalCase.tsx，与组件同名 | `MailList.tsx` |
| Hook | `useXxx.ts` | `useMailboxSync.ts` |
| 类型 | PascalCase，无 `I` 前缀 | `MailItem` |
| 常量 | SCREAMING_SNAKE | `MAX_ATTACHMENT_MB` |
| 事件回调 prop | `onXxx` | `onSelect(threadId)` |
| CSS 类 | kebab-case，BEM 风格 | `.mail-list__item--active` |
| 布尔 | `is/has/can` 前缀 | `isLoading`, `hasUnread` |

### 3.3 TypeScript

- `strict: true`，禁止 `any`（例外需 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + 注释）。
- 领域类型由后端生成或手写镜像，放在 `types/`，**禁止在组件内重复声明**。
- 联合类型优于枚举；`as const` 优于裸字面量。
- 外部数据（Wails 返回）一律视为 `unknown`，用 zod 或类型守卫校验后再用。

### 3.4 React

- 函数组件 + Hooks；不新增 class 组件。
- 状态最小化：能用派生值就不新增 `useState`；跨组件再考虑 Context/Zustand。
- 副作用必须声明依赖完整，禁止 `useEffect` 空依赖里读可变外部变量。
- 列表 key 用业务 ID，禁止 index。
- 异步状态统一三态：`idle | loading | error | success`，禁止用布尔拼状态。
- 每个页面组件必须有：加载骨架、空态、错误态、无权限态。

### 3.5 样式

- 只用设计令牌：[design-system.md](../03-design/design-system.md) 中的 CSS 变量，禁止硬编码颜色/间距。
- 允许硬编码的只有 `0`、`1px` 边框、`100%`。
- 优先 CSS Modules 或单一全局层；不要引入第二套 UI 框架。

---

## 4. 提交前自检（本地必跑）

```bash
# Go
cd desktop && gofmt -l ./internal && go vet ./... && go test ./...
# Frontend
cd desktop/frontend && npm run lint && npm run typecheck && npm run test
```

任何一项失败，不得推送；CI 会重复执行并在失败时阻止合并。

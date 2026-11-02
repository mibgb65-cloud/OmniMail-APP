# TASK-0090 翻译错误分类与生命周期回归

> 状态：待评审 | 负责人：@Codex | 创建：2026-11-02 | 优先级：P1

## 需求与范围
- 用户授权按上一轮评估顺序完善 AI：本任务先修翻译超时误报，补分段失败和进行中撤销授权回归。
- 保留 B 站翻译适配器、显式授权、原文、单任务及不自动重试的现有边界。
- 不读取真实邮件，不调用公网，不提交或推送。

## 分析与计划
- HTTP 响应体读取错误当前统一变成格式无效，丢失取消/超时分类。
- 已有测试只覆盖发请求前取消，没有覆盖响应头已返回后的慢响应体。
1. [x] 先增加失败回归并运行，记录实际失败。
2. [x] 分开取消、读取失败、超限和格式错误，补服务层错误路径测试。
3. [x] 定向验证；最终 verify 与 TASK-0091～0094 联合执行，结果见下方。

## 验收标准
- [x] 响应体期间取消/超时保留上下文错误；网络断流不冒充 JSON 格式错误。
- [x] 分段中途失败不保存成功缓存；撤销授权停止进行中的调用及后续外发。

## 实现与验证
- 新增 read_test.go、translation_failure_test.go，先运行定向测试，响应体超时与断流两项失败，
  实际均为 TRANSLATION_INVALID_RESPONSE；分段失败不缓存、撤销授权两项已有行为通过。
- HTTP 读取错误先保留 ctx.Err，其次归为服务不可用；长度超限继续归为无效响应。
- 修复后 `go -C desktop test ./internal/domain ./internal/platform ./internal/repository ./internal/service ./internal/translationapi -run 'AI|Translation|Translate' -count=1 -timeout=30s` 通过。
- 后续联合执行 repository/service/bridge/app/两个 HTTP 适配器的全包测试通过，未启用公网 smoke。
- 首轮完整 verify 在前端两个旧测试的全页 alert 查询处失败；限定到邮件区域后保留原有断言并通过，
  没有隐藏 AI 错误或删除邮件安全测试。
- 最终 `go -C desktop tool wails3 task verify` **通过**：格式、vet/lint、类型、全部 Go 测试、
  前端 94 文件/807 项、绑定生成与 Windows 构建。最终日志 `desktop/.task/t90-t94-verify-final-2.log`。
- 构建输出 `desktop/.task/verify-bin/OmniMail.exe`，未覆盖 `desktop/bin/OmniMail.exe`。

## Git 与交付
- 开始时工作树干净。提交、推送未授权，保留 active 待评审。
- 不承诺取消能撤回第三方已经收到的文本。
- 实现/验证完成、未暂存、未提交、未推送、未归档，待用户评审。

## 提交与结案计划（2026-11-02，TASK-0096）
- 用户现已明确授权本地提交并完成本任务记录；上述“未授权/未提交”保留为上一阶段事实。
- 复核当前完整门禁和差异后提交实现，产生真实 SHA 后登记、结案并归档，不预填提交号。
- 未授权推送、tag 或远端发布，保留既有风险与未验证项。

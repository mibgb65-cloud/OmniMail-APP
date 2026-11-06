# TASK-0095 DeepSeek V4.1 Flash 默认配置与官方 API 适配

> 状态：已完成 | 负责人：@Codex | 创建：2026-11-02 | 优先级：P1
> 实现提交：`ba58558e94208f4e2bf6e085671e00d88decad80`（本地，未推送）
> 关联：TASK-0091、TASK-0092；保留上一轮所有未提交实现

## 需求与范围
- 用户要求支持 DeepSeek API，默认使用 DeepSeek V4.1 Flash。
- 仅从未配置的 AI 设置表单默认填入官方地址/模型；已有保存配置和主动清空的配置不覆盖。
- 提供显式填入 DeepSeek 配置的入口；不自动保存、开启授权、调用模型或更改 B 站翻译。
- 沿用系统密钥存储及 OpenAI-compatible 链路，不新增依赖/数据库迁移，不提交推送。

## 官方核对（2026-11-02）
- [首次调用](https://api-docs.deepseek.com/)：OpenAI base URL 为 https://api.deepseek.com，
  model 为 deepseek-flash，目前由 DeepSeek-V4.1-Flash-1017 提供，需自己的 API Key。
- [更新日志](https://api-docs.deepseek.com/updates/)：2026-10-17 升级仍使用 deepseek-flash；
  这是服务方别名，不承诺锁定永久版本，不臆造 deepseek-v4.1-flash 为官方 API 标识。
- [思考模式](https://api-docs.deepseek.com/guides/thinking_mode/)：默认开启，
  thinking.type=disabled 可显式关闭；本轮邮件助手使用非思考模式，避免推理占用现有输出/时间预算。
- [JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)：支持 response_format.type=json_object，
  仍须提示 JSON 并处理 stop 但空白的 content，不能把 reasoning_content 当作最终结果。
- 只读取官方文档，不提供真实密钥、不上传任何邮件、不实际调用公网模型。

## 方案与实施计划
1. [x] 先补后端契约失败测试：官方 host/root 或 /v1 才带 thinking/JSON 参数；相似主机、代理、其他协议不污染。
2. [x] 添加最小 endpoint 能力识别及参数；原有严格结果校验、取消和缓存边界不放宽。
3. [x] 表单默认与一键填入、中英文说明；保留已有配置和密钥目的地边界，新增行为测试。
4. [x] 定向检查、完整 verify、文档/任务回填与本轮差异审阅。
- 每步不超过 10 文件/600 行；不为了该预设增加新的持久化 schema 或公开桥接字段。

## 验收标准
- [x] 初次打开默认官方 base URL 和 deepseek-flash，授权为关闭，未保存/未点击测试不外发。
- [x] 保存过的自定义地址/模型、DeepSeek 已有地址与主动清空状态均不被静默替换。
- [x] 只有官方 DeepSeek API 请求启用 JSON/关闭思考；通用服务保持原始参数。
- [x] 空白/截断/只有推理的响应安全失败；未知参数不泄露密钥或正文。

## 实现与验证
- 新增 deepseek_test.go，先运行 `go -C desktop test ./internal/aiapi -run '^TestDeepSeek' -count=1`：
  三个官方地址用例因缺少 thinking/JSON 设置失败，其他地址及空白/截断检查符合已有边界。
- 新增首次配置 UI 测试，先运行 `npm run test -- src/components/MailAI/AISettings.test.tsx -t 初次配置`，
  因地址仍为空失败；实现预填后重跑定向通过。
- 后端 aiapi/service/bridge 的 AI/DeepSeek 定向测试通过；前端设置/分类/语言包 3 文件/15 项通过。
- 新增 aiPresets.ts 仅维护表单建议；不改变持久化 schema，不增加桥接接口，不改系统密钥实现。
- 现有官方根地址或 /v1 保留，填入预设只清空表单密钥、不删除已存同目的地密钥；
  改到不同目的地仍沿用后端不携带旧密钥的安全规则。
- `go -C desktop tool wails3 task verify` **完整通过**：Go/前端格式检查、vet/lint、
  类型检查、全部 Go 测试、前端 94 文件/812 项、绑定生成、前端及 Windows 构建。
  日志 `desktop/.task/t95-verify.log`，产物 `desktop/.task/verify-bin/OmniMail.exe`；
  未覆盖 `desktop/bin/OmniMail.exe` 或自动启动程序。
- 当前 Vite 主包 571.65 kB，仍有原有 >500 kB 建议性告警，不影响构建；
  本轮未扩大到拆包重构。
- 本轮官方核对不包含任何真实 DeepSeek 模型请求；未使用真实用户 Key/邮件，
  未把 jsdom 或本地协议测试当成公网/完整原生窗口验收。

## Git 与风险
- 开始时存在 TASK-0090～0094 的 78 个修改/新增文本文件，全部保留，不重置、不暂存或混称本轮新增。
- 未授权提交、推送、分支切换或归档。实现完成后保持 active 待评审。
- 官方模型别名可能随服务方更新；本机缓存仍需用户主动重新生成以获取新模型结果。
- 实现/验证完成，未暂存、未提交、未推送、未归档；保留 active 待用户评审。

## 提交与结案计划（2026-11-02，TASK-0096）
- 用户现已明确授权本地提交并完成本任务记录；上述“未授权/未提交”保留为上一阶段事实。
- 复核当前完整门禁和差异后提交实现，产生真实 SHA 后登记、结案并归档，不预填提交号。
- 未授权推送、tag 或远端发布，保留既有风险与未验证项。

## 结案与归档（2026-11-02）
- 用户已授权提交与结案，实现已在上述真实提交中登记；未推送、未打 tag。
- TASK-0096 提交前复验完整 verify 通过：前端 94 文件/812 项、全部 Go 检查/测试及 Windows 构建，
  日志 `desktop/.task/t96-verify.log`；原有未验证项不因提交而被视为通过。
- 验收、文档与 Git 处置完成，归档日期 2026-11-02。

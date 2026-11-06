# TASK-0084 账号管理列表显示服务商品牌图标

> 状态：待评审
> 负责人：@Codex | 创建：2026-11-01 | 优先级：P2

## 需求与范围
用户指出邮箱账号管理左侧未显示对应图标。目前实际为所有账号固定绘制同一信封。
接入已有服务商品牌图标，统一尺寸和间距；自定义、未知服务商保留通用图标。
不修改账号信息、选择/断开/同步逻辑，不依据邮箱域名猜服务商，不下载新图标或请求第三方资源。

## 分析与计划
- 复用添加向导与邮箱列表使用的 getProviderIcon，避免维护第二份映射。
- 先增加已知服务商图片及自定义/未知回退回归，执行失败后修改组件。
- 局部 CSS 对 img/svg 统一约束、不压缩、等比显示，图像使用空 alt，不重复读出品牌。
- 定向组件/品牌资产测试、局部格式/类型/lint、浏览器检查本地资源成功解码，
  亮暗和窄窗不挤压。纯小范围 UI 修复不跑 Go 或完整 verify。

## 验收
- [x] 已知服务商显示本地对应品牌图像，126/163 同品牌映射一致。
- [x] 自定义/未知安全回退，无第三方图标请求；账号文案与交互不变。
- [x] 图片能加载且大小一致，亮暗模式和窄窗不变形。

## 实现与验证
- `MailboxManagementDialog.tsx` 复用 getProviderIcon，已知服务商渲染本地 img，
  未知/custom 继续渲染信封。空 alt 保持装饰语义，不改变账号按钮名称及事件。
- 局部 CSS 统一 img/svg 尺寸为现有 icon-size（18px），不参与压缩，图片等比显示。
- 更新管理窗口页面规格，没有下载新资源、引入依赖或修改账号/同步服务。

## 验证记录（2026-11-01）
| 命令/核对 | 实际结果 |
| --- | --- |
| `npx vitest run src/components/MailboxManagementDialog/MailboxManagementDialog.test.tsx`（修复前） | **9 失败 / 8 通过**，对应 9 个内置服务商代码均找不到品牌 img；日志 `.task/t84-tests-before.log` |
| 局部 Prettier 检查、`npm run typecheck`、`npm run lint` | 最终通过；开发中修正测试误用 Playwright 的 exact 参数和 JSX 格式，没有关闭规则 |
| `npx vitest run src/components/MailboxManagementDialog/MailboxManagementDialog.test.tsx src/components/MailDialogs/ProviderBrandAssets.test.ts src/app/MailboxProviders.test.tsx` | **3 文件 / 23 项通过**，含既有断开/重试/选择及新增品牌/回退回归；日志 `.task/t84-tests-final.log` |
| `node desktop/.task/t84-icons-browser-check.mjs` | **通过**：9 个内置代码、8 套本地资源全部实际解码，img 18×18/contain/不压缩；custom/unknown/constructor 三种回退，亮暗与 640px 窄窗、账号选择不变，外部图标请求为 0 |
| `git diff --check` | 通过 |

已人工查看当前聊天可视化目录中的 `account-management-provider-icons-light.png`、
`account-management-provider-icons-dark.png`，仅使用合成 `example.invalid` 账号，
没有复制用户截图中的真实邮箱。夹具、脚本和日志位于忽略的 `.task`。

未运行 Go/全量 verify、未单独启动 Wails 原生程序：只修改两处局部 UI 渲染/样式，
无后端、接口或构建变更；类型/lint、相关交互测试与浏览器真实资源解码覆盖本轮风险。
此验证不等同已重新验收真实邮箱连接或平台全部行为。

## Git 与交付
未授权提交/推送；未提交、未归档，待评审，保留全部已有修改。发布/更新提案仍待评审，不在本轮实施。

# TASK-20261127-001 · 企业邮箱官方品牌高清透明图标替换与 `ProviderIcon` 统一管线

- 状态：Completed
- 实现提交：待提交（工作区已通过全量验证）
- 实际改动：
  1. **6 枚企业邮箱官方高清透明 PNG 资产入库**（`desktop/frontend/src/assets/providers/`）：拷贝 `128×128` 32-bit RGBA 抗锯齿透明官方品牌图标 `tencent_exmail.png`、`aliyun_exmail.png`、`netease_exmail.png`、`feishu.png`、`mail263.png`、`zoho_exmail.png`；
  2. **统一接入 `OFFICIAL_ICONS` 渲染管线**（`desktop/frontend/src/components/common/ProviderIcon.tsx`）：将 6 家企业邮箱全部注册进 `OFFICIAL_ICONS`，与 Gmail / Outlook / QQ / 网易等服务商共享标准中性圆角徽标容器（`background: var(--bg-card)` + `border: 1px solid var(--border-default)` + `0.72 * size` 居中 `contain` 及 `bare` 原图模式），使添加邮箱卡片、左侧边栏、写信发件人选择器、设置账户列表在亮色与暗色主题下全局统一生效且无白边；
  3. **清理废弃手绘组件与冗余样式**：移除 `desktop/frontend/src/components/common/EnterpriseProviderGlyph.tsx` 以及 `desktop/frontend/src/styles/add-account-cards.css` 中的 `.provider-ent-badge` 彩色底框规则；
  4. **补充单元测试**：在 `desktop/frontend/tests/provider-connect-modal.test.mjs` 新增 6 枚企业邮箱 PNG 签名、尺寸（`128×128`）、RGBA 通道（`colorType = 6`）、`OFFICIAL_ICONS` 映射及旧组件清理回归断言。
- 验证结果：
  - 全部手写源码文件严格 `<= 200` 行；执行 `task verify`、`npm run typecheck`、`npm test`（`130/130` 全绿通过）与 `npm run build` 均零报错通过。

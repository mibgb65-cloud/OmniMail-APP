# TASK-0087 写邮件入口不再标注“待开发”

> 状态：已完成
> 负责人：@Codex | 创建：2026-11-02 | 优先级：P2

## 需求与范围
用户截图指出：尚未添加邮箱时，侧栏“写邮件”按钮右侧显示“待开发”，但撰写能力已经接入，
这里只是当前不可用，不能描述成未开发。

范围：`WorkspaceSidebar` 的撰写入口禁用态文案与悬浮/读屏说明，以及随之失效的导航文案键。
不做：不改撰写会话、发送、账号状态或按钮启用条件，不改动其他未接入能力的真实占位说明。

## 分析与计划
- 禁用态徽标直接复用 `navigation.pending`（“待开发”/“Planned”），提示语同为
  “邮箱接入与邮件撰写尚未实现。”——两句都在撰写功能交付后失真。
- 侧栏已有 `mailReady` 与 `onCompose`：可区分“邮箱已加载但没有可用账号”和“邮箱仍在加载”。
  前者应为“未添加邮箱”，后者为“加载中”；有会话时仍显示“继续写邮件”。
- “添加邮箱”入口同样只在邮箱就绪前禁用，原“邮箱账号接入尚未实现，当前仅展示界面。”
  与“待开发”徽标也不再成立，统一改为“加载中”。
- 失效键 `pending`、`composeUnavailable`、`addMailboxUnavailable` 删除，新增
  `composeNeedsMailbox`、`mailLoading`，中英文同步。
- 风险点：徽标在 240px 侧栏内不得撑破按钮；读屏 `aria-describedby` 指向的说明必须与新文案一致。

## 验收
- [x] 没有可用邮箱时，撰写入口显示“未添加邮箱”，不是“待开发”。
- [x] 邮箱尚未加载时，撰写与添加邮箱入口显示“加载中”。
- [x] 有可用账号时撰写入口可点击，不附带任何附加说明。
- [x] 徽标不导致按钮横向溢出；读屏说明与悬浮提示一致。
- [x] 单测与前端检查通过。

## 实现与验证
- `WorkspaceSidebar.tsx`：新增 `composeDisabledHint`（`mailReady ? composeNeedsMailbox : mailLoading`），
  同时用于 `data-tooltip` 与 `<small aria-describedby>` 徽标；`composeUnavailable` 与 `pending` 引用移除。
  添加邮箱入口的禁用提示与徽标改为 `mailLoading`。
- 语言资源：`zh-CN/en` 增加 `composeNeedsMailbox`（未添加邮箱／No mailbox added yet）与
  `mailLoading`（加载中／Loading），删除 `pending`、`composeUnavailable`、`addMailboxUnavailable`。
- `WorkspaceSidebar.test.tsx`：撰写入口用例改为就绪态断言“未添加邮箱”并显式断言不含
  “待开发/Planned”；新增“邮箱未就绪只显示加载中”的中英用例；我的邮箱用例同步改为“加载中”。

## 验证记录（2026-11-02）
| 命令/核对 | 实际结果 |
| --- | --- |
| `npx prettier --check`（4 个改动文件） | 通过 |
| `npx eslint src/app --max-warnings 0` | 通过 |
| `npx tsc --noEmit` | 通过 |
| `npx vitest run`（全量前端） | **91 文件 / 788 项通过** |
| `node .task/t87-compose-browser-check.mjs`（Chromium，合成 props） | 通过：三种状态文案、禁用态读屏说明、徽标不溢出 |

浏览器核对使用合成主题与回调，未连接真实账号；截图 `.task/t87-compose-states.png`、
`.task/t87-compose-sidebar.png` 未纳入版本库。

未运行 Go 测试与完整 `verify`：本轮只改前端文案、语言资源与测试，未触及 Go、接口或依赖。
随 0.0.2 重打包时由发布链路重新执行前端构建。

## Git 与交付
已提交 `43ac80fd`（父提交 `0723677`），随后以同版本 0.0.2 重打包用于本地更新：
产物 `desktop/.task/release/0.0.2-release-4d05c23691284d54a91003e061044c60/`，
交付副本 `desktop/bin/releases/v0.0.2-compose-hint/`，安装包 9,253,864 字节，
SHA-256 `a266c9eeb5b6e35623f0831ef19bbf20cb0429a459c850bd7a299ad12e6359d3`。
未推送、未创建 GitHub Release；任务记录与索引随 docs 提交登记。

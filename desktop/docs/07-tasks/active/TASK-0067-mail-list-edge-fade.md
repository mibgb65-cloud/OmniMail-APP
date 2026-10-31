# TASK-0067 邮件列表上下滚动边缘羽化

> 2026-11-01 收尾：用户已接受本批交付并授权本地提交，未授权推送；联合验证和归档由 TASK-0072 登记。下方未授权文字保留当轮历史含义。

> 状态：待评审
> 负责人：@Codex | 创建：2026-10-31 | 优先级：P2

## 需求与范围
- 用户要求截图中的邮件列表增加上下 Scroll Edge Fade，必须使用
  `mask-image: linear-gradient(...)` 的透明羽化，禁止背景色伪元素遮挡。
- 仅在对应边缘还有隐藏内容时渐隐；到达首尾或无溢出时对应边缘保持清晰。
- 保留无限滚动、重试、键盘焦点、列表切换重置及星标等交互，兼容亮暗背景。
- 不修改邮件协议、数据、布局比例或添加依赖；不提交、推送。

## 分析与计划
- 当前 `MailList` 使用原生滚动 section；已有 `ScrollArea edgeFade` 在邮箱侧栏使用，
  通过透明 CSS mask 和共享滚动度量实现条件羽化，滚动轨道不受遮罩影响。
- 复用现有组件，拆分列表外层尺寸/边框与内层滚动布局，不重复增加渐变实现。
  改为具名 region 视口后保留原有 aria/焦点语义，并调整重试定位到真实滚动视口。
- 先增加邮件列表集成回归，再接入组件；运行定向组件、无限滚动/筛选回归、
  前端静态检查和构建；用脱敏模拟数据在浏览器核对首/中/尾、亮暗主题和滚动条。
- 本轮小范围前端接入复用已有组件，不修改公共组件、Go、接口或构建配置，
  可使用前端检查和构建代替整仓 Go/Windows verify；最终记录实际范围。
- 工作树已有 TASK-0061～0066 等未提交修改，原样保留；混合文件仅修改本任务片段。

## 验收标准
- [x] 邮件列表内容使用透明 mask，顶/底仅在对应方向仍可滚动时羽化。
- [x] 无背景色覆盖伪元素，边框/滚动条不参与 mask，亮暗主题均可见。
- [x] 无限加载、重试焦点、键盘导航与列表切换重置不回归。
- [x] 定向测试及前端质量检查通过，真实桌面热更新状态如实报告。

## 实现、验证与 Git
- `MailList.tsx` 复用 `ScrollArea edgeFade`；具名 region 的 aria/busy/tabIndex 和滚动加载
  均位于真实视口。重试聚焦同一 region，原 `listKey` 保持追加与查询切换语义。
- `MailList.module.css` 外层保留布局宽度、容器查询和分栏边框，内层单独负责纵向内容排版，
  不修改共享 ScrollArea 的 CSS 或增加伪元素；羽化沿用现有 16px 透明 gradient。
- `MailContent.test.tsx` 新增邮件列表集成回归，测试首/中/尾/无溢出，以及轨道不在内容遮罩内。
- 组件规范与收件箱文档已更新；没有新增依赖、文案键、桥接字段或数据变更。

## 实际验证（2026-10-31）
| 命令或核对项 | 实际结果 |
| --- | --- |
| `npm test -- src/app/MailContent.test.tsx -t '邮件列表按真实滚动边缘羽化'`（接入前） | 失败：原列表未启用 edgeFade；接入后新回归通过 |
| `npm test -- src/app/MailContent.test.tsx src/app/useMailList.test.ts src/app/MailUnreadSession.test.tsx src/components/ScrollArea` | 6 文件、62 用例通过 |
| `npm run check`（frontend 工作目录） | ESLint、Prettier、TypeScript 及全量前端测试通过：71 文件、634 用例 |
| `npm run build` | 类型检查和 Vite 生产构建通过 |
| `node desktop/.task/t67-browser-check.mjs` | Chromium 通过：亮暗主题首中尾 mask、无背景伪元素遮挡、边框/轨道独立、无限加载、键盘、动态溢出、查询重置、重试焦点、760×640 小窗口、减少动态效果；无 pageerror |
| 运行中的开发窗口 | 原 OmniMail 进程继续运行，22:25 Vite 日志记录 MailList HMR；未重启 Go/数据库 |
| 最终差异、编码及文档链接 | `git diff --check`、本任务 7 个文件 UTF-8 无 BOM 及相对链接检查通过 |

- 浏览器使用 `.invalid` 脱敏夹具、临时本地 9257 端口，不使用真实邮件或原生桥接。
  首次用正式开发端口访问夹具被 Vite allow list 拒绝，随后独立预览仅放行 frontend/.task；
  未放宽项目正式配置。浏览器键盘平滑滚动结束后再切主题，避免测试之间滚动竞争。
  完成后已停止临时 9257 预览进程，原生开发窗口及 9245 开发服务继续运行。
- 截图：
  `C:/Users/mimanchi/.codex/visualizations/2026/10/31/01a19224-c7b2-73b2-92ff-935015655544/t67-mail-list-light.png`
  和同目录 `t67-mail-list-dark.png`，均为模拟数据。
- 未运行整仓 Go/Windows verify：本轮仅复用已有前端组件、布局及测试，前端完整检查和生产构建
  已覆盖修改路径。未做真实桌面窗口截图像素验收或 macOS 原生 WebView 验收；
  不将 Chromium 夹具与 HMR 日志冒称这些平台的原生视觉验收。

## Git 与交付
- 提交、推送均未授权；不归档，交付时保留 active 待评审。
- 保留用户既有改动，混合文件不擅自暂存；未提交、未推送，待评审。

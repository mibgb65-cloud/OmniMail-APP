# TASK-0031 修消息面板与铃铛按钮脱开

> 状态：待评审 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P2

## 需求与范围

- 用户反馈“消息提示框位置有点靠上，和下方的提示按钮脱离了”。
- 只调整 `MessagesPopover` 面板的垂直锚点，保持宽度、水平对齐、层级、动效与文案不变；不改后端与交互逻辑。

## 分析与计划

- 现状：`.root` 未设定位，`.panel` 的定位祖先实际是 `App.module.css` 的 `.sidebar-footer`（`position: relative`）；`bottom: calc(100% + var(--space-3))` 以页脚上边缘为基准再加 8px，而页脚有 `padding-top: var(--space-6)`（20px），所以面板比铃铛按钮高出约 28px，视觉上与触发器脱开。
- 计划：把 `bottom` 改为 `calc(var(--space-9) + var(--space-3))`，即“触发器高度（`--space-9`）之上再留 `--space-3`”，与页脚内边距解耦；水平偏移、`z-index`、阴影保持原样。

## 验收标准

- [x] 面板底边与铃铛按钮盒之间保持 `--space-3` 间距，不再被页脚顶部内边距顶高。
- [x] 面板宽度、水平位置、“消息 / 暂无新消息”文案与关闭按钮均无变化。
- [x] 窄屏（≤680px）媒体查询下面板翻转到按钮下方的行为不受影响。

## 实现与验证

- `desktop/frontend/src/components/MessagesPopover/MessagesPopover.module.css`：`.panel` 的 `bottom` 由 `calc(100% + var(--space-3))` 改为 `calc(var(--space-9) + var(--space-3))`，并补充注释说明定位祖先与页脚内边距的耦合。
- 验证：dev 窗口对比截图 `desktop/.devdata/previews/msg-before.png`（修正前，面板底边约 y=903）与 `msg-after.png`（修正后，面板底边约 y=935，铃铛按钮盒顶约 y=944）；`npm run -s test -- src/components/MessagesPopover` 10 项通过；`npm exec -- prettier --check src/components/MessagesPopover` 通过。
- 未验证：≤680px 窄屏下翻转后的间距未实测；未重新打包。

## Git 与风险

- 未授权提交或推送；不暂存、不归档，待用户评审。
- 风险：`bottom` 依赖“触发器高度 = `--space-9`”与“触发器贴住页脚底边”两个前提，若页脚新增下内边距或触发器改高，需要同步调整。

## 过程记录

- 首版核对截图时多次点击铃铛导致面板被开→关，抓到的是关闭态；面板在点击内部元素时先触发 `pointerdown` 外部关闭再被 `onClick` 切换，单次点击即从关闭态打开、再点一次即关闭。

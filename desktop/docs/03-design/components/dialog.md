# 标准模态弹窗 DialogFrame

> 状态：已实现 | 最后更新：2026-10-29
> 相关：[TASK-0043](../../07-tasks/archive/2026/10/TASK-0043-shared-dialog-frame.md)、
> [TASK-0045](../../07-tasks/archive/2026/10/TASK-0045-dialog-exit-motion.md)

## 用途与统一基准

设置、添加邮箱、撰写邮件，以及后续同类表单/配置模态弹窗统一使用 `DialogFrame`。
不把 Tooltip、下拉菜单、Toast 或系统原生确认框改造成大型模态窗；抽屉也不是本外框的用途。

- 桌面标准外框为 **900×580 CSS px**，由 `--dialog-width`、`--dialog-height` 唯一定义。
- 小视口按宽高分别收缩，预留总计 `--space-8` 的安全空间，居中显示，不超出视口。
- 统一 `--radius-lg` 圆角、主题边框/背景、`--modal-shadow`、
  `--color-modal-scrim` 遮罩及 `--modal-backdrop-blur` 背景模糊。
- 入场使用共享动效，退出使用 `--motion-modal-exit`（140ms）的淡出/轻微下移动效，
  遮罩同步淡出，减少动效偏好下取消；不因切换步骤、错误提示或加载状态改变外框高度。
- 不强制所有弹窗都有设置侧栏；各业务保留自己的信息结构。
- 添加邮箱在共用外框内采用“左侧进度 / 右侧选项与表单”：左栏与设置导航等宽，
  右栏固定标题/关闭和主要操作，内容独立滚动。小窗口仍保留紧凑左右列；
  进度展示选择服务商、配置账号、验证连接、同步邮件四阶段，不作为跳过配置或认证的导航入口。
  账号创建后展示后台同步安排结果，由完成按钮关闭，不把后台安排成功当成全部邮件同步完成。
  选中背景为单个复用的纵向滑块，支持快速前进/后退和减少动效；业务阶段不为播放动画而延迟。
  预设账号使用简洁登录，自定义账号才显示协议与服务器配置，Gmail 的密码明确为应用专用密码。

## 组件边界与使用

`DialogFrame` 转发标准原生 dialog 属性、事件和 `HTMLDialogElement` 引用，
追加共用样式、`aria-modal` 及 `data-dialog-frame="standard"` 标识。
业务使用 `useDialogExit(dialogRef, onClosed)` 获取 `closing` 和 `close`，将 `closing`
传给外框，在原有允许关闭的入口调用 `close`。业务仍决定何时允许关闭，外框只协调视觉退出；
请求中止、发送中禁止关闭、原有 showModal/焦点约束和恢复策略不变。

```tsx
const exit = useDialogExit(dialogRef, onClosed);
const requestClose = () => {
  request.current?.abort(); // 业务请求立即取消，不能等动画结束才处理。
  exit.close();
};

<DialogFrame
  ref={dialogRef}
  closing={exit.closing}
  aria-labelledby={titleId}
  onCancel={(event) => {
    event.preventDefault();
    requestClose();
  }}
>
  <form onSubmit={handleSubmit}>
    <header>{/* 标题与关闭入口 */}</header>
    <div className={styles.content}>{/* 可滚动的业务内容 */}</div>
    <footer>{/* 固定可达的主要操作 */}</footer>
  </form>
</DialogFrame>
```

### 退出生命周期

- 关闭、完成、Esc 与设置有效遮罩点击统一经过退出流程，不在这些入口直接通知父组件卸载。
- 退出期间原生 dialog 保持 open/modal、背景仍不可操作；外框阻止点击、键盘和重复提交，
  不通过提前 close/移除 open 属性制造遮罩闪断。
- 若入场尚未完成，读取当前透明度、变换及支持时的 backdrop 透明度作为退出起点，
  不先跳回完全显示。只动画 opacity/transform，背景模糊值不逐帧插值。
- DOM 提交关闭状态后，收集并等待 target 为外框本身的动画（含 backdrop 伪元素），
  排除子元素的加载/循环动画；完成后才原生 close、恢复焦点并通知业务卸载。
- 完成路径幂等；动画取消同样结算，按实际动画时长设兜底，上限 1 秒，
  不依赖单个 animationend 事件。无动画 API 或减少动效时立即关闭。
- 父组件强制卸载不人为延迟；清理计时器并使旧动画完成失效，不能误关下一次打开的弹窗。
  撰写发送期间仍按原策略禁止关闭，账号关闭立即 abort 并停止未开始批次。

## 内容滚动与焦点

- 表单以 `height: 100%`、flex 纵向布局占满外框；标题与操作栏不收缩。
- 内容区使用 `flex: 1 1 auto`、`min-height: 0` 和 `overflow: auto`，避免外层第二条滚动条。
- 长表单、小窗口及键盘聚焦到末尾字段时，关闭和提交仍可到达，不能仅用 overflow 隐藏内容。
- 设置原有左右布局与各面板滚动保留；标准外框不负责业务内部导航。
- Tooltip 继续使用共用 TooltipHost，并在支持时升至 top layer，不通过改大外框来规避遮挡。

## 后续约束与反例

- 新增同类模态窗必须复用此组件，不再直接写独立 `<dialog>` 外框；
  `dialogMigration.test.ts` 对生产组件的原生 dialog 声明执行回归检查。
- 不在业务 CSS 重复定义外框宽高、圆角、遮罩或阴影；需要统一调整时修改共享 Token/样式。
- 不为了与设置页长宽一致而复制设置的导航、关闭策略或表单业务。
- 不扩大窗口尺寸隐藏表单问题，也不通过禁用校验、焦点限制或取消逻辑换取布局通过。

## 验证

组件测试验证引用、语义和事件转发；退出专项覆盖完成等待、重复关闭、减少动效、取消/兜底、
强制卸载与晚到信号、立即取消批量请求和发送期间保护；既有设置、账号、撰写及 Tooltip 测试覆盖业务回归。
Chromium 隔离验证比较三种外框在 1280×900、960×720 与 480×500 视口下的实际尺寸，
检查步骤切换、内部滚动、固定操作栏、明暗主题与减少动效。
退出专项还逐帧采样外框/遮罩透明度、modal 保持及快速入场中关闭的连续性，
并以真实 Esc/遮罩点击、动效中切换减少动效和焦点恢复补充验证。
极小视口的入口由脚本调用，仅验证弹窗自身的响应式，不代表已实现完整的小屏导航。
原生 WebView 全流程、真实认证/发送及其他平台实机另行验证。

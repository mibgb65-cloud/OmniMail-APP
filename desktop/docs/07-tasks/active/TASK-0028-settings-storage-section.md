# TASK-0028 设置页新增“存储情况”分类

> 状态：待评审 | 负责人：@Codex | 创建：2026-10-27 | 优先级：P2

## 需求与范围

- 用户要求“设置页面需要增加一个存储情况的页面，显示当前软件所占用的不同的存储类型的情况”。
- 只做前端 UI：在设置对话框左侧导航新增“存储情况”分类，展示总占用、按存储类型的分布条与明细列表，样式复用现有 token；不改后端、不新增绑定接口、不新增依赖、不改“通用设置”与“关于”面板内容。

## 分析与计划

- 现状：设置对话框 `<dialog>` 内为两分类（通用设置 / 关于），导航是 `role="tablist"` + 手写键盘导航，面板用 `hidden` 切换。
- 计划：`SettingsSection` 扩展为 `general | storage | about`，中间插入“存储情况”；面板内容抽成 `SettingsStorage`，含标题栏（说明 + “界面预览 · 示例数据”标记）、总计数字、比例条、四类明细（邮件数据 / 附件缓存 / 全文索引 / 运行日志）与底部说明。
- 真实统计尚未接入，全部数字为示例值：组件内用常量 `categories` 声明字节数并在注释中说明替换点，界面固定展示“界面预览 · 示例数据”与“存储统计尚未接入”提示，避免把演示数据当成真实占用。
- 比例条与明细圆点使用单色 token 阶梯（`--storage-tone-1..4`）而非多色，保持项目扁平、token 驱动的视觉语言；浅色与深色各自定义，条宽按 `flexGrow: bytes` 等比例分配。
- 无障碍：导航沿用 `tablist` 方向键 / Home / End 语义，面板为 `role="tabpanel"` + `aria-labelledby`；比例条用 `role="img"` + 汇总 `aria-label` 表达分布，明细用列表语义。
- 用运行中的 Wails dev 窗口 + Vite 热更新核对浅色与深色效果，不重新打包、不跑完整 `verify`。

## 验收标准

- [x] 设置导航出现“存储情况”，键盘方向键 / Home / End 在三分类间正确循环并聚焦到选中标签。
- [x] 面板展示总量、比例条与四类占用明细，百分比之和为 100%，切换分类时面板互斥显示。
- [x] 示例数据与“尚未接入”均由界面文案明确标注，不被表述为真实统计。
- [x] 中英文文案齐全，`zh-CN` 与 `en` 键结构一致。
- [x] 浅色与深色主题下比例条阶梯、分隔线、次要文字对比度均可读。

## 实现与验证

- `desktop/frontend/src/components/SettingsDialog/SettingsStorage.tsx`（新增）：示例常量 `categories`（邮件数据 648 MB、附件缓存 336 MB、全文索引 152 MB、运行日志 96 MB，各含 `label` / `description` 键）；`formatBytes`（≥1 GB 取两位小数 GB，≥10 MB 取整，其余一位小数）；总量 1.20 GB；`share()` 计算百分比；渲染 `.storage-head`（标题 + 预览标记）、`.storage-intro`、`.storage-total`、`.storage-bar`（`role="img"`，4 段 `data-tone` + `flexGrow`）、`.storage-items` 列表与 `.storage-note`。
- `desktop/frontend/src/components/SettingsDialog/SettingsNavigation.tsx`：`SettingsSection` 增加 `storage`；`titles` 增加 `storageTitle`；新增 `settingsSectionTitles` 导出与 `at(position, fallback)` 辅助函数，方向键 / `Home` / `End` 按实际分类数量取目标项（避免数组下标越界导致的类型与运行时不一致）。
- `desktop/frontend/src/components/SettingsDialog/SettingsDialog.tsx`：头部标题改用 `settingsSectionTitles[section]`；新增 `storage` 面板 `role="tabpanel"` + `hidden` 切换，置于“关于”面板之前。
- `desktop/frontend/src/components/SettingsDialog/SettingsDialog.module.css`：新增 `.storage-head`、`.storage-head h3`、`.storage-preview`、`.storage-intro`、`.storage-total`（大号数字 + `--tracking-tight`）、`.storage-bar`、`.storage-bar span[data-tone]` / `.storage-dot[data-tone]` 色调映射、`.storage-items`、`.storage-item`（分隔线，末项无）、`.storage-dot`、`.storage-size`（等宽数字 + 右对齐百分比）、`.storage-note`；窄宽度媒体查询下明细行换行并对齐缩进。
- `desktop/frontend/src/styles/tokens.css`：新增 `--storage-tone-1..4` 与 `--storage-track`，浅色为深灰 100/76/50/26% 阶梯，深色为浅灰同阶梯。
- `desktop/frontend/src/components/UiIcon/UiIcon.tsx`：`icons` 增加 `storage: HardDrive`。
- `desktop/frontend/src/locales/zh-CN/settings.json`、`desktop/frontend/src/locales/en/settings.json`：新增 `storageTitle`、`storageUsage`、`storagePreview`、`storageDescription`、`storageTotal`、四类 `storage*` 标签与描述、`storageNote`。
- `desktop/frontend/src/components/SettingsDialog/SettingsDialog.test.tsx`：补充三分类的方向键 / Home / End 用例；新增“存储情况按存储类型展示占用，并标明示例数据”用例（标题、面板可见性、`aria-selected`、预览标记、`1.20 GB`、比例条 `aria-label` 汇总、四条明细、说明文字、未触发 `onClose`）与切换分类面板互斥用例。
- 验证：`npm run test` 全量 24 文件 252 项通过；`npm run typecheck` 退出码 0；`npm exec -- eslint src/components/SettingsDialog src/components/UiIcon` 无输出；`npm exec -- prettier --check` 全部改动文件通过（`SettingsDialog.tsx` 首轮报格式问题，`--write` 后复查通过）。
- 视觉验证：dev 窗口浅色截图 `desktop/.devdata/previews/stg-7.png`、深色截图 `desktop/.devdata/previews/stg-8-dark.png`；两主题下标题、预览标记、总量数字、比例条阶梯、四行明细与底部说明均完整可见，深色下阶梯与次要文字对比度正常。
- 未验证：真实存储统计接入后的数值与刷新行为（当前为示例数据）；窄屏断点下设置对话框未逐一实测；未重新打包，未做其他平台实测。

## Git 与风险

- 未授权提交或推送；不暂存、不归档，待用户评审。
- 风险：面板展示的是示例值，接入后端统计前若被误读为真实占用量会造成误导，故保留“界面预览 · 示例数据”标记与“存储统计尚未接入”说明；接入时需替换 `categories` 的字节数来源、按实际目录归属调整分类，并同步移除预览标记。

## 过程记录

- 首版纵向节奏偏松，浅色截图里最后一行“运行日志”被面板滚动边缘裁切；把总计上边距由 `--space-5` 收到 `--space-4`、列表上边距由 `--space-6` 收到 `--space-4`、行内边距由 `--space-4` 收到 `--space-3`、底部说明由 `--space-5` 收到 `--space-4` 后，单屏可容纳标题栏 + 总量 + 比例条 + 四行明细 + 说明。
- `formatBytes` 初版 MB 阈值取 100 导致 96 MB 显示为 `96.0 MB`，与测试期望不符；改为 ≥10 MB 取整。
- 测试中切换分类后按名称查找 `tabpanel` 找不到元素：未选中面板带 `hidden` 不在无障碍树内，改为切换前先取出面板元素再断言其 `hidden` 属性。
- 截图脚本相对输出路径会触发 GDI+ 保存异常，须传绝对路径；主题切换后的深色验证改从“通用设置 → 外观开关”切到深色，标题栏主题按钮的坐标点击在合成输入下不稳定。

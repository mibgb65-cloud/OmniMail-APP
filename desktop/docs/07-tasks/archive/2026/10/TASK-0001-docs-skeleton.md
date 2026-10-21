# TASK-0001 文档目录骨架与初始内容

> 状态：已完成
> 负责人：@arch-lead | 创建：2026-10-15 | 实际：1 天 | 优先级：P0
> 关联：[docs/README.md](../../../../README.md) · [roadmap M0](../../../../01-product/roadmap.md#m0-骨架)

## 目标

在 `desktop/docs/` 中建立 00-08 九大分区文档骨架，每份文档具备可执行的具体内容
（而非空占位），使新成员与 AI 助手有唯一的事实来源。

## 范围

### 包含
- 根入口 README（导航、命名规则、维护约定）
- `00-guidelines`：代码规范、Git 约定、文档规范、AI 协作规范
- `01-product`：overview / requirements / roadmap + 7 篇功能设计
- `02-architecture`：overview、backend、frontend(2)、desktop(2)、database(3)、ADR(5)
- `03-design`：设计系统、组件(4)、页面(4)、资源清单
- `04-development`：快速开始、工程结构、环境、API(6)、故障排查
- `05-testing`：策略、用例(5 类)、缺陷模板
- `06-release`：build / windows / macos / checklist
- `07-tasks`：README、backlog、active(3)、archive/2026/10
- `08-history`：changelog、milestones、retrospectives

### 不包含
- 具体功能实现相关文档的最终定稿（待实现过程中迭代）
- 截图与设计资源二进制（由设计产出后补入 `03-design/assets`）

## 实施结果

已创建 9 个一级目录、21 个子目录、45 个文档文件。所有内部链接使用相对路径。

## 验收标准

- [x] 目录结构与约定完全一致
- [x] 每份文档有状态与最后更新标记
- [x] 内部相对链接均指向存在的文件
- [x] 无占位式空文档（每篇均有可执行内容）

## 验证记录

| 日期 | 验证内容 | 结果 |
| --- | --- | --- |
| 2026-10-15 | 目录结构核对 | 通过 |
| 2026-10-15 | 相对链接存在性检查 | 通过 |

## 完成记录

- 提交：—
- 文档更新：全部（首次创建）
- 归档日期：2026-10-15

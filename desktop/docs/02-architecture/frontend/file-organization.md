# 前端文件组织与模块边界

> 状态：草稿 | 负责人：@frontend-lead | 最后更新：2026-10-15
> 相关：[前端架构](README.md) · [代码规范](../../00-guidelines/coding-standards.md)

---

## 1. 模块边界规则

1. `features/x` 只能通过 `features/x/index.ts` 对外暴露；跨功能引用必须走出口。
2. `components/` 中的组件**不得** import `features/**`（通用层不感知业务）。
3. `lib/` 不得 import `features/**` 或 `components/**`（纯工具层）。
4. `app/` 可以 import 一切，是装配层。
5. 循环依赖视为错误，由 `eslint-plugin-import/no-cycle` 拦截。

```
允许的依赖方向：
app → features → components → lib
features → lib
app → components, lib
禁止：components → features、lib → 任何上层
```

## 2. 文件命名速查

| 内容 | 约定 | 示例 |
| --- | --- | --- |
| 页面 | `XxxPage.tsx` | `InboxPage.tsx` |
| 容器/功能区 | `XxxView.tsx` | `MailDetailView.tsx` |
| 列表/表格 | `XxxList.tsx` | `MailList.tsx` |
| 弹窗 | `XxxDialog.tsx` | `AccountDialog.tsx` |
| Hook | `useXxx.ts` | `useMailList.ts` |
| Store | `xxx.store.ts` | `mail.store.ts` |
| 类型 | `types.ts`（功能内） | — |
| 常量 | `constants.ts`（功能内） | `MAILBOX_LABELS` |
| 测试 | 同名 `.test.tsx` | `MailList.test.tsx` |

## 3. 组件分类

| 分类 | 位置 | 判定标准 |
| --- | --- | --- |
| 原子组件 | `components/ui/` | 无业务语义，只由 props 驱动 |
| 复合组件 | `components/<domain-agnostic>/` | 如 `SplitPane`、`VirtualList` |
| 功能组件 | `features/<x>/components/` | 依赖该功能的状态或 API |
| 布局组件 | `app/layout/` | 只负责外壳与栅格 |

## 4. 单个组件的标准结构

```tsx
// features/mail/components/MailRow.tsx
import { memo } from 'react';
import type { MailListItem } from '../types';
import styles from './MailRow.module.css';

interface MailRowProps {
  item: MailListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}

export const MailRow = memo(function MailRow({ item, isActive, onSelect }: MailRowProps) {
  return (
    <div
      role="option"
      aria-selected={isActive}
      data-unread={!item.isRead}
      className={`${styles.row} ${isActive ? styles.active : ''}`}
      onClick={() => onSelect(item.id)}
    >
      {/* ... */}
    </div>
  );
});
```

约定：

- 具名导出，不用 default（除路由页面懒加载需要）。
- props 接口定义在文件内，`interface XxxProps`。
- 逻辑超过 30 行的组件，把逻辑抽到同功能 `hooks/`。
- 样式文件同名 `.module.css`，置于同目录。

## 5. 状态放置决策树

```
这个状态需要跨页面共享吗？
├─ 否 → 组件 useState / useReducer
└─ 是
   ├─ 只是服务端（Go）数据镜像 → 放 feature store，以事件驱动更新
   └─ 纯 UI 状态（选中、折叠、滚动）→ 放 app 级 store 或 URL
```

- 禁止把请求结果同时存放在两个地方。
- 派生数据用 selector 计算，不另存。

## 6. 导入顺序（ESLint 自动排序）

```ts
// 1. node_modules
import { useEffect } from 'react';
// 2. 别名绝对路径（@/）
import { Button } from '@/components/ui/Button';
// 3. 相对路径
import { useMailList } from '../hooks/useMailList';
// 4. 类型
import type { MailListItem } from '../types';
// 5. 样式
import styles from './MailList.module.css';
```

路径别名：`@/` → `src/`（`vite.config.ts` 与 `tsconfig.json` 同步配置）。

## 7. 何时新建 feature

- 有独立的数据来源（新的 bridge API 组）+ 独立路由或独立面板。
- 有 ≥ 3 个专属组件。
- 否则先放在现有 feature 的 `components/` 下，别过早拆分。

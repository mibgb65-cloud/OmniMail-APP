import type { MailItem, MailLabel } from "../../types/mail";

export const LABEL_PRESET_SWATCHES = [
  "#2563EB",
  "#4F46E5",
  "#16A34A",
  "#D97706",
  "#DC2626",
  "#0891B2",
] as const;

export const LABEL_NAME_MAX_LEN = 30;

export type LabelTriState = "checked" | "indeterminate" | "unchecked";

/**
 * 计算单封或多封邮件相对于某个标签的三态选中状态：
 * - 全部目标邮件拥有 = "checked"
 * - 部分目标邮件拥有 = "indeterminate"
 * - 均未拥有 = "unchecked"
 */
export function computeLabelTriState(
  mails: ReadonlyArray<Pick<MailItem, "id" | "labels">>,
  mailIds: ReadonlyArray<string>,
  labelId: string,
): LabelTriState {
  if (!labelId || mailIds.length === 0) return "unchecked";
  const idSet = new Set(mailIds);
  let totalMatched = 0;
  let hasCount = 0;
  for (const m of mails) {
    if (!idSet.has(m.id)) continue;
    totalMatched += 1;
    if (m.labels.includes(labelId)) hasCount += 1;
  }
  if (totalMatched === 0 || hasCount === 0) return "unchecked";
  if (hasCount === totalMatched) return "checked";
  return "indeterminate";
}

/**
 * 按搜索词过滤已有标签，并判断是否展示「创建并应用『xxx』」快捷行。
 * 当输入非空且与所有已有标签名称（忽略大小写）均不完全相等时，允许一键新建并贴标。
 */
export function filterLabelsWithCreateOption(
  labels: ReadonlyArray<MailLabel>,
  query: string,
  localize?: (raw: string) => string,
): {
  filtered: MailLabel[];
  trimmedQuery: string;
  canCreateNew: boolean;
} {
  const trimmedQuery = query.trim().slice(0, LABEL_NAME_MAX_LEN);
  const needle = trimmedQuery.toLowerCase();
  if (!needle) {
    return { filtered: [...labels], trimmedQuery: "", canCreateNew: false };
  }
  let exactExists = false;
  const filtered: MailLabel[] = [];
  for (const lb of labels) {
    const display = localize ? localize(lb.name) : lb.name;
    const rawLow = lb.name.trim().toLowerCase();
    const dispLow = display.trim().toLowerCase();
    if (rawLow === needle || dispLow === needle) {
      exactExists = true;
    }
    if (rawLow.includes(needle) || dispLow.includes(needle)) {
      filtered.push(lb);
    }
  }
  return {
    filtered,
    trimmedQuery,
    canCreateNew: !exactExists,
  };
}

/** 统计当前已加载邮件集合中各标签关联的邮件数（供侧边栏徽章展示） */
export function countLabelUsage(
  mails: ReadonlyArray<Pick<MailItem, "labels">>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of mails) {
    for (const lid of m.labels) {
      counts[lid] = (counts[lid] ?? 0) + 1;
    }
  }
  return counts;
}

/** 计算级联子菜单或侧边栏右侧浮层的视口安全坐标（右侧放不下时自动翻折到左侧） */
export function computeSidePopoverCoords(
  anchorRect: { left: number; top: number; right: number; bottom: number },
  popWidth: number,
  estHeight: number,
  viewport = { width: window.innerWidth, height: window.innerHeight },
  gap = 6,
): { left: number; top: number; side: "right" | "left" } {
  const canPlaceRight =
    anchorRect.right + gap + popWidth <= viewport.width - 10;
  const side =
    canPlaceRight || anchorRect.left - gap - popWidth < 10 ? "right" : "left";
  const rawLeft =
    side === "right"
      ? anchorRect.right + gap
      : anchorRect.left - gap - popWidth;
  const left = Math.max(
    10,
    Math.min(rawLeft, Math.max(10, viewport.width - popWidth - 10)),
  );
  const top = Math.max(
    10,
    Math.min(
      anchorRect.top - 4,
      Math.max(10, viewport.height - estHeight - 12),
    ),
  );
  return { left, top, side };
}

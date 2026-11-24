import type { CSSProperties } from "react";

export type ReaderActionId =
  "reply" | "forward" | "archive" | "snooze" | "label";

export interface ReaderToolbarLayout {
  actions: readonly ReaderActionId[];
  density: "icons" | "compact" | "labels";
  aiLabel: "icon" | "short" | "full";
  showCount: boolean;
  showDelete: boolean;
}

// 与 CSS 共用按键占位，避免翻译状态、页码和 AI 开关文案改变时重新分配空间。
const slots = {
  icon: 30,
  action: 64,
  translation: 112,
  caret: 24,
  aiShort: 50,
  aiFull: 80,
  count: 84,
  itemGap: 6,
  groupGap: 8,
};

export const readerToolbarSlotStyles = {
  "--reader-icon-width": `${slots.icon}px`,
  "--reader-action-width": `${slots.action}px`,
  "--reader-translation-width": `${slots.translation}px`,
  "--reader-translation-caret-width": `${slots.caret}px`,
  "--reader-ai-short-width": `${slots.aiShort}px`,
  "--reader-ai-full-width": `${slots.aiFull}px`,
  "--reader-count-width": `${slots.count}px`,
  "--reader-item-gap": `${slots.itemGap}px`,
  "--reader-group-gap": `${slots.groupGap}px`,
} as CSSProperties;

const fallback: ReaderToolbarLayout = {
  actions: [],
  density: "icons",
  aiLabel: "icon",
  showCount: false,
  showDelete: false,
};

const essentials = ["reply", "label"] as const;
const compact: ReaderToolbarLayout = {
  ...fallback,
  actions: essentials,
  density: "labels",
  aiLabel: "short",
  showDelete: true,
};
const regular: ReaderToolbarLayout = {
  ...compact,
  actions: ["reply", "archive", "label"],
  aiLabel: "full",
};
const expanded: ReaderToolbarLayout = {
  ...regular,
  actions: ["reply", "forward", "archive", "label"],
};

export function getReaderToolbarRequiredWidth(layout: ReaderToolbarLayout) {
  const iconOnly = layout.density === "icons";
  const left = [
    ...layout.actions.map(() => (iconOnly ? slots.icon : slots.action)),
    layout.density === "labels" ? slots.translation : slots.icon + slots.caret,
    ...(layout.showDelete ? [slots.icon] : []),
    slots.icon, // 更多
  ];
  const aiWidth = {
    icon: slots.icon,
    short: slots.aiShort,
    full: slots.aiFull,
  };
  const right = [
    ...(layout.showCount ? [slots.count] : []),
    slots.icon,
    slots.icon,
    aiWidth[layout.aiLabel],
  ];
  const groupWidth = (widths: number[]) =>
    widths.reduce((total, width) => total + width, 0) +
    (widths.length - 1) * slots.itemGap;
  return groupWidth(left) + slots.groupGap + groupWidth(right);
}

const tiers: ReaderToolbarLayout[] = [
  {
    ...expanded,
    actions: ["reply", "forward", "archive", "snooze", "label"],
    showCount: true,
  },
  { ...expanded, showCount: true },
  expanded,
  regular,
  compact,
  { ...compact, density: "compact" },
  { ...fallback, actions: essentials, showDelete: true, aiLabel: "short" },
  { ...fallback, actions: essentials },
  { ...fallback, actions: ["reply"] },
];

const tiersByWidth = tiers.map((layout) => ({
  layout,
  minWidth: getReaderToolbarRequiredWidth(layout),
}));

export function getReaderToolbarLayout(contentWidth: number) {
  return (
    tiersByWidth.find(({ minWidth }) => contentWidth >= minWidth)?.layout ??
    fallback
  );
}

import type { CSSProperties } from "react";
import type { LanguageCode } from "../../../types/settings.ts";

export type ReaderActionId =
  "reply" | "forward" | "archive" | "snooze" | "label";

export interface ReaderToolbarLayout {
  actions: readonly ReaderActionId[];
  density: "icons" | "compact" | "labels";
  aiLabel: "icon" | "short" | "full";
  showCount: boolean;
  showDelete: boolean;
}

interface ToolbarLocaleSlots {
  icon: number;
  action: number;
  actionWidths?: Record<ReaderActionId, number>;
  translation: number;
  caret: number;
  aiShort: number;
  aiFull: number;
  count: number;
  itemGap: number;
  groupGap: number;
}

// 与 CSS 共用按键占位，中文按等宽槽位，英文按按钮内容紧凑槽位防截断与防挤压。
const zhSlots: ToolbarLocaleSlots = {
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

const enSlots: ToolbarLocaleSlots = {
  icon: 30,
  action: 86,
  actionWidths: {
    reply: 70,
    forward: 86,
    archive: 82,
    snooze: 82,
    label: 69,
  },
  translation: 122,
  caret: 24,
  aiShort: 54,
  aiFull: 88,
  count: 68,
  itemGap: 5,
  groupGap: 10,
};

function buildSlotStyles(s: ToolbarLocaleSlots): CSSProperties {
  return {
    "--reader-icon-width": `${s.icon}px`,
    "--reader-action-width": `${s.action}px`,
    "--reader-translation-width": `${s.translation}px`,
    "--reader-translation-caret-width": `${s.caret}px`,
    "--reader-ai-short-width": `${s.aiShort}px`,
    "--reader-ai-full-width": `${s.aiFull}px`,
    "--reader-count-width": `${s.count}px`,
    "--reader-item-gap": `${s.itemGap}px`,
    "--reader-group-gap": `${s.groupGap}px`,
  } as CSSProperties;
}

export const readerToolbarSlotStyles = buildSlotStyles(zhSlots);
const enReaderToolbarSlotStyles = buildSlotStyles(enSlots);

export function getReaderToolbarSlotStyles(
  locale: LanguageCode = "zh-CN",
): CSSProperties {
  return locale === "en-US"
    ? enReaderToolbarSlotStyles
    : readerToolbarSlotStyles;
}

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

export function getReaderToolbarRequiredWidth(
  layout: ReaderToolbarLayout,
  locale: LanguageCode = "zh-CN",
) {
  const s = locale === "en-US" ? enSlots : zhSlots;
  const iconOnly = layout.density === "icons";
  const left = [
    ...layout.actions.map((act) =>
      iconOnly ? s.icon : (s.actionWidths?.[act] ?? s.action),
    ),
    layout.density === "labels" ? s.translation : s.icon + s.caret,
    ...(layout.showDelete ? [s.icon] : []),
    s.icon, // 更多
  ];
  const aiWidth = { icon: s.icon, short: s.aiShort, full: s.aiFull };
  const right = [
    ...(layout.showCount ? [s.count] : []),
    s.icon,
    s.icon,
    aiWidth[layout.aiLabel],
  ];
  const groupWidth = (widths: number[]) =>
    widths.reduce((total, width) => total + width, 0) +
    (widths.length - 1) * s.itemGap;
  return groupWidth(left) + s.groupGap + groupWidth(right);
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

const tiersByWidthZh = tiers.map((layout) => ({
  layout,
  minWidth: getReaderToolbarRequiredWidth(layout, "zh-CN"),
}));

const tiersByWidthEn = tiers.map((layout) => ({
  layout,
  minWidth: getReaderToolbarRequiredWidth(layout, "en-US"),
}));

export function getReaderToolbarLayout(
  contentWidth: number,
  locale: LanguageCode = "zh-CN",
) {
  const table = locale === "en-US" ? tiersByWidthEn : tiersByWidthZh;
  return (
    table.find(({ minWidth }) => contentWidth >= minWidth)?.layout ?? fallback
  );
}

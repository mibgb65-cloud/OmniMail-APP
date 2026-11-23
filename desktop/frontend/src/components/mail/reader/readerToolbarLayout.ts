export type ReaderActionId =
  "reply" | "forward" | "archive" | "snooze" | "label";

interface ReaderToolbarLayout {
  actions: readonly ReaderActionId[];
  showCount: boolean;
  showDelete: boolean;
  shortAiLabel: boolean;
}

const stacked: ReaderToolbarLayout = {
  actions: ["reply", "label"],
  showCount: false,
  showDelete: true,
  shortAiLabel: true,
};
const compact: ReaderToolbarLayout = {
  actions: ["reply", "archive", "label"],
  showCount: false,
  showDelete: true,
  shortAiLabel: false,
};
const regular: ReaderToolbarLayout = {
  ...compact,
  actions: ["reply", "forward", "archive", "label"],
  showCount: true,
};
const full: ReaderToolbarLayout = {
  ...regular,
  actions: ["reply", "forward", "archive", "snooze", "label"],
};

// 使用实际工具栏内容宽度，而不是窗口断点；AI 侧栏展开时它会继续缩小。
export function getReaderToolbarLayout(
  contentWidth: number,
): ReaderToolbarLayout {
  if (contentWidth >= 760) return full;
  if (contentWidth >= 630) return regular;
  if (contentWidth >= 485) return compact;
  return stacked;
}

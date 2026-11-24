import type { TranslationKey } from "../../i18n";
import type { IconName } from "../common/Icon";
import type { PaletteCategory, PaletteCommand } from "./usePaletteCommands";

export type PaletteCommandTuple = [
  string,
  Exclude<PaletteCategory, "all">,
  IconName,
  TranslationKey,
  TranslationKey,
  () => void,
  string?,
];

export function filterPaletteCommands(
  list: PaletteCommand[],
  query: string,
  category: PaletteCategory,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  onSearchFts: (q: string) => void,
): PaletteCommand[] {
  const q = query.trim();
  const lower = q.toLowerCase();
  const matched = list.filter(
    (c) =>
      (category === "all" || c.cat === category) &&
      (!lower ||
        c.title.toLowerCase().includes(lower) ||
        c.hint.toLowerCase().includes(lower)),
  );
  if (q) {
    matched.unshift({
      id: `fts-${q}`,
      cat: "actions",
      icon: "search",
      title: t("overlays.cmdFtsSearchTitle", { query: q }),
      hint: t("overlays.cmdFtsSearchHint"),
      run: () => onSearchFts(q),
    });
  }
  return matched;
}

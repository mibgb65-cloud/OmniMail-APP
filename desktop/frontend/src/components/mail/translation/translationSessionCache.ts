import type { TranslationEntry } from "./translationStreamState";

export function updateScopedTranslation<
  T extends { token: object; entries: Record<string, TranslationEntry> },
>(
  state: T,
  token: object,
  mailId: string,
  update: (entry?: TranslationEntry) => TranslationEntry | undefined,
): T {
  if (state.token !== token) return state;
  const old = Object.prototype.hasOwnProperty.call(state.entries, mailId)
    ? state.entries[mailId]
    : undefined;
  const entry = update(old);
  if (!entry || old === entry) return state;
  // 保留运行中的请求，仅淘汰不活跃的旧译文。
  const rest = Object.entries(state.entries).filter(([id]) => id !== mailId);
  const pending = rest.filter(([, item]) => item.phase === "pending");
  const completed = rest
    .filter(([, item]) => item.phase !== "pending")
    .slice(-23);
  return {
    ...state,
    entries: Object.fromEntries([...completed, ...pending, [mailId, entry]]),
  };
}

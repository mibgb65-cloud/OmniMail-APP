export const MAIL_LIST_TOP_PILL_THRESHOLD = 240;

export function mailListScrollFlags(top: number) {
  return { scrolled: top > 0, showPill: top > MAIL_LIST_TOP_PILL_THRESHOLD };
}

export function selectArrivalIds(
  ids: readonly string[],
  existing: ReadonlySet<string>,
  requested: Set<string>,
) {
  const candidates: string[] = [];
  for (const id of ids) {
    if (existing.has(id) || requested.has(id)) continue;
    requested.add(id);
    candidates.push(id);
  }
  return candidates;
}

export function consumeArrivalsAtTop(
  top: number,
  matching: Set<string>,
  deferred: boolean,
) {
  if (top > 0) return false;
  const refresh = deferred || matching.size > 0;
  matching.clear();
  return refresh;
}

export function addedMailIds(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("addedIds" in payload))
    return [];
  const ids = payload.addedIds;
  return Array.isArray(ids)
    ? ids.filter(
        (id): id is string =>
          typeof id === "string" &&
          id.length > 0 &&
          id.length <= 128 &&
          id.trim() === id,
      )
    : [];
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  email: string;
  mailCount: number;
}

export interface DuplicateGroupShape {
  key: string;
  candidates?: readonly DuplicateCandidate[] | null;
}

export interface GroupSelection {
  selected: boolean;
  primaryId: string;
  excluded: readonly string[];
}

export const sortedCandidates = <T extends DuplicateCandidate>(
  candidates: readonly T[] | null | undefined,
) =>
  [...(candidates ?? [])].sort(
    (a, b) => b.mailCount - a.mailCount || a.id.localeCompare(b.id),
  );

export function groupSelection(
  group: DuplicateGroupShape,
  saved?: GroupSelection,
): GroupSelection {
  return (
    saved ?? {
      selected: true,
      primaryId: sortedCandidates(group.candidates)[0]?.id ?? "",
      excluded: [],
    }
  );
}

export function visibleDuplicateCandidates<T extends DuplicateCandidate>(
  sorted: readonly T[],
  expanded: boolean,
) {
  return expanded ? sorted : sorted.slice(0, 2);
}

export function createMergePlan(
  group: DuplicateGroupShape,
  selection = groupSelection(group),
) {
  const candidates = group.candidates ?? [];
  if (!candidates.some((c) => c.id === selection.primaryId)) return null;
  const excluded = new Set(selection.excluded);
  const duplicateIds = candidates
    .filter((c) => c.id !== selection.primaryId && !excluded.has(c.id))
    .map((c) => c.id);
  return duplicateIds.length
    ? { groupKey: group.key, primaryId: selection.primaryId, duplicateIds }
    : null;
}

export function duplicatePreview(groups: readonly DuplicateGroupShape[]) {
  const emailCount = groups.reduce(
    (total, group) => total + (group.candidates?.length ?? 0),
    0,
  );
  const preview = groups
    .slice(0, 3)
    .map((group) => {
      const candidate = sortedCandidates(group.candidates)[0];
      const name = candidate?.name.trim();
      const safeName =
        name && !name.includes("@")
          ? Array.from(name).slice(0, 24).join("")
          : "未命名联系人";
      return `${safeName}（${group.candidates?.length ?? 0} 个邮箱）`;
    })
    .join("、");
  return {
    emailCount,
    preview: `包含：${preview}${groups.length > 3 ? "…" : ""}`,
  };
}

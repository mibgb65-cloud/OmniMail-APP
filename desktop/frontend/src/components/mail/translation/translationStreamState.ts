import type {
  MailTranslation,
  TranslationMode,
  TranslationOptions,
  TranslationResult,
} from "./translationTypes";

export interface TranslationRequestKey {
  profileId: string;
  mailId: string;
  requestId: string;
}

export type TranslationBatch = TranslationRequestKey &
  Pick<MailTranslation, "source" | "segments"> & {
    subject?: string;
    completedBatches: number;
    totalBatches: number;
  };

export interface TranslationEntry {
  key: TranslationRequestKey;
  result: TranslationResult;
  mode: TranslationMode;
  phase: "pending" | "complete" | "partial" | "failed";
  completedBatches: number;
  totalBatches: number;
  error?: string;
}

export function matchesTranslationRequest(
  key: TranslationRequestKey,
  candidate: unknown,
): boolean {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "profileId" in candidate &&
    candidate.profileId === key.profileId &&
    "mailId" in candidate &&
    candidate.mailId === key.mailId &&
    "requestId" in candidate &&
    candidate.requestId === key.requestId
  );
}

export function sameTranslationSettings(
  a: TranslationOptions,
  b: TranslationOptions,
) {
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.includeSubject === b.includeSubject
  );
}

export function startTranslation(
  key: TranslationRequestKey,
  options: TranslationOptions,
  previous?: TranslationEntry,
  preserveMode = false,
): TranslationEntry {
  const retry =
    previous?.phase === "partial" &&
    sameTranslationSettings(previous.result.options, options)
      ? previous
      : undefined;
  return {
    key,
    result: {
      options,
      content: retry?.result.content ?? {
        source: options.source,
        target: options.target,
        subject: "",
        segments: {},
      },
    },
    phase: "pending",
    mode: preserveMode && previous ? previous.mode : options.mode,
    completedBatches: 0,
    totalBatches: 0,
  };
}

export function changeTranslationMode(
  entry: TranslationEntry,
  mode: TranslationMode,
): TranslationEntry {
  return {
    ...entry,
    mode,
    result:
      mode === "original"
        ? entry.result
        : {
            ...entry.result,
            options: { ...entry.result.options, mode },
          },
  };
}

export function applyTranslationBatch(
  entry: TranslationEntry | undefined,
  batch: TranslationBatch,
): TranslationEntry | undefined {
  if (
    !entry ||
    entry.phase !== "pending" ||
    !matchesTranslationRequest(entry.key, batch)
  )
    return entry;
  const content = entry.result.content;
  return {
    ...entry,
    completedBatches: Math.max(entry.completedBatches, batch.completedBatches),
    totalBatches: batch.totalBatches,
    result: {
      ...entry.result,
      content: {
        ...content,
        source: batch.source === "auto" ? content.source : batch.source,
        subject: batch.subject || content.subject,
        segments: { ...content.segments, ...batch.segments },
      },
    },
  };
}

export function finishTranslation(
  entry: TranslationEntry | undefined,
  snapshot: TranslationBatch,
) {
  const updated = applyTranslationBatch(entry, snapshot);
  if (!updated || updated === entry) return entry;
  // 仅最后的完整响应能写入完整缓存；收到最后一批事件不代表请求已成功结束。
  if (snapshot.completedBatches < snapshot.totalBatches)
    return { ...updated, phase: "partial" } satisfies TranslationEntry;
  return {
    ...updated,
    phase: "complete",
    completedBatches: snapshot.completedBatches,
    result: {
      ...updated.result,
      content: {
        ...updated.result.content,
        subject: snapshot.subject ?? "",
        segments: snapshot.segments,
      },
    },
  } satisfies TranslationEntry;
}

export function failTranslation(
  entry: TranslationEntry | undefined,
  key: TranslationRequestKey,
  error: string,
) {
  if (
    !entry ||
    entry.phase !== "pending" ||
    !matchesTranslationRequest(key, entry.key)
  )
    return entry;
  return {
    ...entry,
    phase:
      Object.keys(entry.result.content.segments).length > 0
        ? "partial"
        : "failed",
    error,
  } satisfies TranslationEntry;
}

export function canReuseTranslation(
  entry: TranslationEntry | undefined,
  options: TranslationOptions,
) {
  return (
    entry?.phase === "complete" &&
    sameTranslationSettings(entry.result.options, options)
  );
}

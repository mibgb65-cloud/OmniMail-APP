import {
  plainTextToComposeHtml,
  sanitizeComposeHtml,
} from "./composeRichHtml.ts";

export type InlineAiPresetId =
  "draft" | "formal" | "concise" | "translate_en" | "custom";

export type InlineAiPhase = "idle" | "warmup" | "streaming" | "completed";

export interface InlineAiPresetDef {
  id: Exclude<InlineAiPresetId, "custom">;
  action: string;
  tone: string;
  labelKey:
    | "compose.generateFirstDraft"
    | "compose.makeFormal"
    | "compose.makeConcise"
    | "compose.translateToEn";
}

export interface InlineAiRunRecord {
  presetId: InlineAiPresetId;
  action: string;
  tone: string;
  prompt: string;
  sourceBody: string;
}

export const INLINE_AI_PRESETS: readonly InlineAiPresetDef[] = [
  {
    id: "draft",
    action: "draft",
    tone: "professional",
    labelKey: "compose.generateFirstDraft",
  },
  {
    id: "formal",
    action: "polish",
    tone: "professional",
    labelKey: "compose.makeFormal",
  },
  {
    id: "concise",
    action: "polish",
    tone: "concise",
    labelKey: "compose.makeConcise",
  },
  {
    id: "translate_en",
    action: "translate_en",
    tone: "professional",
    labelKey: "compose.translateToEn",
  },
] as const;

export function resolveInlineAiPhase(
  busy: boolean,
  preview: string,
): InlineAiPhase {
  const hasPreview = preview.trim().length > 0;
  if (busy) return hasPreview ? "streaming" : "warmup";
  return hasPreview ? "completed" : "idle";
}

export function deriveComposeAiLockState(
  busy: boolean,
  activePreset: InlineAiPresetId | null,
) {
  return {
    promptDisabled: busy,
    presetsDisabled: busy,
    highlightedPreset: busy ? activePreset : null,
    editorReadOnly: busy,
    sendDisabled: busy,
    scheduleDisabled: busy,
  };
}

export function countInlineAiChars(text: string): number {
  const compact = text.replace(/\r?\n/g, "").trim();
  return compact ? Array.from(compact).length : 0;
}

export function buildReplacedDraftBody(aiText: string): {
  body: string;
  bodyHtml: string;
} {
  const clean = aiText.replace(/\r\n/g, "\n").trim();
  return {
    body: clean,
    bodyHtml: plainTextToComposeHtml(clean),
  };
}

export function buildAppendedDraftBody(
  currentBody: string,
  currentBodyHtml: string | undefined,
  aiText: string,
): { body: string; bodyHtml: string } {
  const cleanAi = aiText.replace(/\r\n/g, "\n").trim();
  if (!cleanAi) {
    return {
      body: currentBody,
      bodyHtml: currentBodyHtml ?? plainTextToComposeHtml(currentBody),
    };
  }
  const trimmedOrig = currentBody.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  const hasImage = Boolean(currentBodyHtml?.includes("<img"));
  if (!trimmedOrig && !hasImage) {
    return buildReplacedDraftBody(cleanAi);
  }
  const origHtml = sanitizeComposeHtml(
    currentBodyHtml?.trim()
      ? currentBodyHtml
      : plainTextToComposeHtml(trimmedOrig),
  );
  const aiHtml = plainTextToComposeHtml(cleanAi);
  return {
    body: trimmedOrig ? `${trimmedOrig}\n\n${cleanAi}` : cleanAi,
    bodyHtml: origHtml ? `${origHtml}<div><br /></div>${aiHtml}` : aiHtml,
  };
}

export function createInlineAiSessionTracker(
  cancelRequest: (requestId: string) => void,
) {
  let seqCounter = 0;
  let active: {
    seq: number;
    draftId: string;
    reqId: string;
    cancelled: boolean;
  } | null = null;

  return {
    startRun(draftId: string): number {
      if (active && !active.cancelled && active.reqId) {
        cancelRequest(active.reqId);
      }
      seqCounter += 1;
      active = { seq: seqCounter, draftId, reqId: "", cancelled: false };
      return seqCounter;
    },
    bindRequestId(seq: number, reqId: string): boolean {
      if (!reqId) return false;
      if (!active || active.seq !== seq || active.cancelled) {
        cancelRequest(reqId);
        return false;
      }
      active.reqId = reqId;
      return true;
    },
    isRunCurrent(seq: number): boolean {
      return Boolean(active && active.seq === seq && !active.cancelled);
    },
    acceptEvent(
      requestId: string | undefined,
      currentDraftId: string,
    ): boolean {
      if (!requestId || !active || active.cancelled) return false;
      return active.reqId === requestId && active.draftId === currentDraftId;
    },
    finishByEvent(requestId: string): void {
      if (active && active.reqId === requestId) {
        active = null;
      }
    },
    stopCurrent(): boolean {
      if (!active || active.cancelled) return false;
      const toCancel = active.reqId;
      active.cancelled = true;
      active.reqId = "";
      if (toCancel) cancelRequest(toCancel);
      return true;
    },
  };
}

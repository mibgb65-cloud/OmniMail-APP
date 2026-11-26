import type { composeInlineAi as zhComposeInlineAi } from "../zh/composeInlineAi.ts";

export const composeInlineAi = {
  aiDraftingHeaderPill: "Omni AI drafting…",
  stopGeneratingBtn: "Stop generating",
  inputLockedPill: "Input locked",
  sendPromptAria: "Submit writing instructions",
  thinkingStatus: "Understanding context and drafting…",
  streamingCountStatus: "Streaming · {count} chars",
  generatedCountBadge: "Generated · {count} chars",
  stoppedCountBadge: "Stopped · {count} chars kept",
  previewDraftPill: "AI Suggested Draft",
  previewSafeHint: "Live preview · Original body untouched until adopted",
  writingBodyStatus: "Writing body…",
  escToStopHint: "Press Esc anytime to stop and keep generated text",
  continueRefineHint: "Type follow-up instructions, e.g. “Make it shorter”",
  replaceCurrentBodyBtn: "Replace current body",
  appendToEndBtn: "Append to end",
  regenerateBtn: "Regenerate",
  editorReadonlyBanner: "Current draft body (protected until adopted)",
  editorReadonlyPill: "Read-only while generating · Original body preserved",
  footerSendLockedHint: "Review and send once AI finishes generating",
  appendedAiBodyToast: "Appended AI content to draft body",
} satisfies typeof zhComposeInlineAi;

import { useEffect, useEffectEvent, useLayoutEffect } from "react";
import { useApp } from "../../state/AppContext";
import { useTranslation } from "../mail/translation/TranslationContext";
import { scheduleAutoMailSummary } from "./autoMailSummary";

export function useAiMailOnOpen(open: boolean, blocked: boolean) {
  const { workspace, mailStore, aiStore } = useApp();
  const mailId = mailStore.selectedMail?.id;
  const { activeProfileId, settings } = workspace;
  const { explicitlyOpened } = mailStore;
  const { confirmedSource } = useTranslation();
  const {
    loadCachedForMail,
    onCacheReadFailure,
    autoSummarize,
    stopGeneration,
  } = aiStore;
  const readable = open && settings.aiEnabled && !blocked;
  const autoEnabled = settings.aiAutoSummarizeOnOpen && explicitlyOpened;
  const uiLanguage = settings.language === "en-US" ? "en" : "zh-CN";

  const startSummary = useEffectEvent((id: string, profileId: string) => {
    // 用户正在确认手动操作时，不抢占请求，也不代替用户确认。
    if (
      readable &&
      autoEnabled &&
      mailId === id &&
      activeProfileId === profileId &&
      workspace.overlay.type !== "ai-consent"
    )
      autoSummarize(id, confirmedSource);
  });

  useLayoutEffect(() => {
    if (!readable || !mailId) return;
    return () => stopGeneration(mailId);
  }, [activeProfileId, mailId, readable, stopGeneration]);

  useEffect(() => {
    if (!readable || !mailId) return;
    let left = false;
    const cache = loadCachedForMail(mailId).catch((err: unknown) => {
      if (!left) onCacheReadFailure(mailId, err);
      // 读取失败时无法确定未缓存，不能将其视作开启云端请求的依据。
      return undefined;
    });
    const cancelTimer = autoEnabled
      ? scheduleAutoMailSummary(cache, uiLanguage, () =>
          startSummary(mailId, activeProfileId),
        )
      : undefined;

    return () => {
      left = true;
      cancelTimer?.();
      stopGeneration(mailId, true);
    };
  }, [
    activeProfileId,
    autoEnabled,
    loadCachedForMail,
    mailId,
    onCacheReadFailure,
    readable,
    stopGeneration,
    uiLanguage,
  ]);
}

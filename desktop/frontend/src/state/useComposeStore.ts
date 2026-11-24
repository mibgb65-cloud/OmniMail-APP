import { useCallback, useEffect, useRef, useState } from "react";
import { composeApi } from "../services/backendClient";
import { isWailsDesktop } from "./storageHelpers";
import type { EmailAccount } from "../types/account";
import type { MailItem } from "../types/mail";
import type { ComposeDraftState } from "../types/settings";

function draftContentFingerprint(d: ComposeDraftState): string {
  return JSON.stringify([
    d.id,
    d.accountId,
    d.unlockIdentity,
    d.to,
    d.cc,
    d.bcc,
    d.subject,
    d.body,
    d.scheduledAtUnixMs,
    d.attachments.map((a) => `${a.id}:${a.status}:${a.filePath ?? ""}`),
  ]);
}

export function useComposeStore(
  accounts: EmailAccount[],
  defaultAccountId: string,
  quickReplyScope: string,
) {
  const [draft, setDraft] = useState<ComposeDraftState | null>(null);
  const [quickReply, setQuickReply] = useState({ scope: "", text: "" });
  const quickReplyText =
    quickReply.scope === quickReplyScope ? quickReply.text : "";
  const setQuickReplyText = (text: string) =>
    setQuickReply({ scope: quickReplyScope, text });
  const lastSavedFpRef = useRef("");

  useEffect(() => {
    if (!draft || !isWailsDesktop()) return;
    const fp = draftContentFingerprint(draft);
    if (fp === lastSavedFpRef.current) return;
    const timer = window.setTimeout(() => {
      void composeApi
        .saveDraft(draft)
        .then((saved) => {
          lastSavedFpRef.current = draftContentFingerprint(saved);
          setDraft((prev) =>
            prev && prev.id === saved.id
              ? {
                  ...prev,
                  savedAt: saved.savedAt,
                  lockedAccount: saved.lockedAccount,
                }
              : prev,
          );
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const openNewCompose = useCallback(
    (prefillTo?: string[]) => {
      if (isWailsDesktop()) {
        void composeApi
          .createDraft({ mode: "new", prefillTo })
          .then((created) => {
            if (created) {
              lastSavedFpRef.current = draftContentFingerprint(created);
              setDraft(created);
            }
          })
          .catch(() => undefined);
        return;
      }
      const accId =
        accounts.find((a) => a.id === defaultAccountId)?.id ??
        accounts[0]?.id ??
        "acc-gmail";
      setDraft({
        id: `draft-${Date.now()}`,
        mode: "new",
        minimized: false,
        accountId: accId,
        lockedAccount: false,
        to: prefillTo ?? [],
        cc: [],
        bcc: [],
        showCcBcc: false,
        subject: "",
        body: "",
        attachments: [],
        savedAt: new Date().toTimeString().slice(0, 5),
      });
    },
    [accounts, defaultAccountId],
  );

  const openReplyCompose = useCallback(
    (
      mail: MailItem,
      mode: "reply" | "reply-all" | "forward",
      lockOriginal: boolean,
    ) => {
      if (isWailsDesktop()) {
        void composeApi
          .createDraft({ mode, replyToMailId: mail.id })
          .then((created) => {
            if (created) {
              lastSavedFpRef.current = draftContentFingerprint(created);
              setDraft(created);
            }
          })
          .catch(() => undefined);
        return;
      }
      const prefix = mode === "forward" ? "Fwd: " : "Re: ";
      const cleanSub = mail.subject.replace(/^(Re|Fwd):\s*/i, "");
      const quoted = `\n\n--- 原始邮件 ---\n发件人：${mail.senderName} <${mail.senderEmail}>\n时间：${mail.fullTimeText}\n主题：${mail.subject}\n\n${mail.messages[mail.messages.length - 1]?.bodyParagraphs.join("\n") ?? mail.snippet}`;
      setDraft({
        id: `draft-${Date.now()}`,
        mode,
        minimized: false,
        accountId: mail.accountId,
        lockedAccount: lockOriginal,
        to:
          mode === "forward"
            ? []
            : [`${mail.senderName} <${mail.senderEmail}>`],
        cc:
          mode === "reply-all" && mail.cc
            ? mail.cc.split(",").map((s) => s.trim())
            : [],
        bcc: [],
        showCcBcc: mode === "reply-all",
        subject: `${prefix}${cleanSub}`,
        body: mode === "forward" ? quoted : "",
        attachments: [],
        savedAt: "刚刚",
        replyToMailId: mail.id,
      });
    },
    [],
  );

  const openSavedDraft = useCallback((draftOrMailId: string) => {
    if (!isWailsDesktop()) return;
    void composeApi
      .getDraft(draftOrMailId)
      .then((loaded) => {
        if (loaded) {
          lastSavedFpRef.current = draftContentFingerprint(loaded);
          setDraft({ ...loaded, minimized: false });
        }
      })
      .catch(() => undefined);
  }, []);

  const updateDraft = useCallback((patch: Partial<ComposeDraftState>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const closeDraft = useCallback(() => setDraft(null), []);

  const discardDraft = useCallback(() => {
    setDraft((prev) => {
      if (prev && isWailsDesktop()) {
        void composeApi.deleteDraft(prev.id).catch(() => undefined);
      }
      return null;
    });
  }, []);

  return {
    draft,
    setDraft,
    openNewCompose,
    openReplyCompose,
    openSavedDraft,
    updateDraft,
    closeDraft,
    discardDraft,
    quickReplyText,
    setQuickReplyText,
  };
}

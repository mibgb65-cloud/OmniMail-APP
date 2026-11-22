import { useCallback, useState } from "react";
import type { EmailAccount } from "../types/account";
import type { MailItem } from "../types/mail";
import type { ComposeDraftState } from "../types/settings";

export function useComposeStore(
  accounts: EmailAccount[],
  defaultAccountId: string,
) {
  const [draft, setDraft] = useState<ComposeDraftState | null>(null);
  const [quickReplyText, setQuickReplyText] = useState("");

  const openNewCompose = useCallback(
    (prefillTo?: string[]) => {
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
        savedAt: "10:46",
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
      const prefix = mode === "forward" ? "Fwd: " : "Re: ";
      const cleanSub = mail.subject.replace(/^(Re|Fwd):\s*/i, "");
      const quoted = `\n\n--- 原始邮件 ---\n发件人：${mail.senderName} <${mail.senderEmail}>\n时间：${mail.fullTimeText}\n主题：${mail.subject}\n\n${mail.messages[mail.messages.length - 1]?.bodyParagraphs.join("\n") ?? mail.snippet}`;

      setDraft({
        id: `draft-${Date.now()}`,
        mode,
        minimized: false,
        accountId: mail.accountId,
        lockedAccount: mode !== "forward" && lockOriginal,
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
        attachments:
          mode === "forward"
            ? mail.attachments.map((a) => ({
                id: a.id,
                name: a.name,
                sizeText: a.sizeText,
                status: "ready" as const,
              }))
            : [],
        savedAt: "刚刚",
        replyToMailId: mail.id,
      });
    },
    [],
  );

  const updateDraft = useCallback((patch: Partial<ComposeDraftState>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch, savedAt: "刚刚" } : prev));
  }, []);

  const closeDraft = useCallback(() => setDraft(null), []);

  return {
    draft,
    setDraft,
    openNewCompose,
    openReplyCompose,
    updateDraft,
    closeDraft,
    quickReplyText,
    setQuickReplyText,
  };
}

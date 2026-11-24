import { useCallback } from "react";
import { t } from "../i18n";
import { composeApi, parseBackendError } from "../services/backendClient";
import type { EmailAccount } from "../types/account";
import type { ComposeDraftState } from "../types/settings";
import { createSentMailItem, type SendMailPayload } from "./mailFactory";
import { isWailsDesktop } from "./storageHelpers";
import type { useComposeStore } from "./useComposeStore";
import type { useMailStore } from "./useMailStore";
import type { useToasts } from "./useToasts";

export type FullSendPayload = SendMailPayload & {
  draft?: ComposeDraftState;
  replyToMailId?: string;
};

export function useSendMailAction(
  accounts: EmailAccount[],
  undoSendSeconds: number,
  mailStore: ReturnType<typeof useMailStore>,
  composeStore: ReturnType<typeof useComposeStore>,
  toastStore: ReturnType<typeof useToasts>,
) {
  return useCallback(
    (payload: FullSendPayload) => {
      const account =
        accounts.find((a) => a.id === payload.accountId) ?? accounts[0];
      if (!isWailsDesktop()) {
        const created = createSentMailItem(account, payload);
        mailStore.addMail(created);
        toastStore.pushToast(
          {
            tone: "success",
            title: payload.scheduledAt
              ? t("toasts.queuedScheduledPreview", {
                  time: payload.scheduledAt,
                })
              : t("toasts.sendingViaPreview", {
                  account:
                    account?.shortTag ?? t("toasts.defaultMailboxFallback"),
                }),
            detail: t("toasts.undoSecondsDetail", {
              seconds: undoSendSeconds,
            }),
            actionLabel: t("toasts.undoSendAction"),
            onAction: () => {
              mailStore.permanentDelete([created.id]);
              composeStore.openNewCompose(payload.to);
            },
          },
          undoSendSeconds * 1000,
        );
        return;
      }

      void (async () => {
        try {
          let targetDraft = payload.draft;
          if (!targetDraft) {
            const init = await composeApi.createDraft({
              mode: payload.replyToMailId ? "reply" : "new",
              accountId: payload.accountId,
              replyToMailId: payload.replyToMailId,
              prefillTo: payload.to,
              subject: payload.subject,
              body: payload.body,
            });
            if (!init) return;
            targetDraft = {
              ...init,
              body: payload.body,
              subject: payload.subject,
            };
          }
          const job = await composeApi.sendDraft({
            draft: targetDraft,
            scheduledAtUnixMs: targetDraft.scheduledAtUnixMs,
            unlockIdentity: targetDraft.unlockIdentity,
          });
          if (!job) return;
          void mailStore.reloadMessages();
          toastStore.pushToast(
            {
              tone: "success",
              title:
                job.state === "scheduled"
                  ? t("toasts.queuedScheduled", {
                      time:
                        payload.scheduledAt ??
                        t("toasts.scheduledFallbackTime"),
                    })
                  : t("toasts.queuedOutbox", {
                      account:
                        account?.shortTag ?? t("toasts.defaultMailboxFallback"),
                    }),
              detail:
                job.state === "scheduled"
                  ? t("toasts.scheduledPersistsDetail")
                  : t("toasts.undoZeroNetDetail", {
                      seconds: undoSendSeconds,
                    }),
              actionLabel:
                job.state === "undo_pending"
                  ? t("toasts.undoSendAction")
                  : undefined,
              onAction:
                job.state === "undo_pending"
                  ? () => {
                      void composeApi
                        .undoSend(job.id)
                        .then((restored) => {
                          if (restored) composeStore.setDraft(restored);
                          toastStore.pushToast({
                            tone: "info",
                            title: t("toasts.undoRestoredDraft"),
                          });
                        })
                        .catch((err) =>
                          toastStore.pushToast({
                            tone: "warning",
                            title: t("toasts.undoFailedTitle"),
                            detail: parseBackendError(err).message,
                          }),
                        );
                    }
                  : undefined,
            },
            undoSendSeconds * 1000,
          );
        } catch (err) {
          toastStore.pushToast({
            tone: "danger",
            title: t("toasts.submitOutboxFailed"),
            detail: parseBackendError(err).message,
          });
        }
      })();
    },
    [accounts, undoSendSeconds, mailStore, toastStore, composeStore],
  );
}

import { useCallback } from "react";
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
              ? `已加入定时队列（${payload.scheduledAt}）`
              : `正在通过 ${account?.shortTag ?? "默认邮箱"} 发送…`,
            detail: `${undoSendSeconds} 秒内可撤销发送`,
            actionLabel: "撤销发送",
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
                  ? `已加入定时发送队列（${payload.scheduledAt ?? "计划时间"}）`
                  : `已加入发件队列（${account?.shortTag ?? "邮箱"}）`,
              detail:
                job.state === "scheduled"
                  ? "重启应用也不会丢失定时任务"
                  : `${undoSendSeconds} 秒内可零网络撤回`,
              actionLabel:
                job.state === "undo_pending" ? "撤销发送" : undefined,
              onAction:
                job.state === "undo_pending"
                  ? () => {
                      void composeApi
                        .undoSend(job.id)
                        .then((restored) => {
                          if (restored) composeStore.setDraft(restored);
                          toastStore.pushToast({
                            tone: "info",
                            title: "已撤回发送并恢复为草稿",
                          });
                        })
                        .catch((err) =>
                          toastStore.pushToast({
                            tone: "warning",
                            title: "无法撤回邮件",
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
            title: "提交发件队列失败",
            detail: parseBackendError(err).message,
          });
        }
      })();
    },
    [accounts, undoSendSeconds, mailStore, toastStore, composeStore],
  );
}

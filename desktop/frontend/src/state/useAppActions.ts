import { useCallback } from "react";
import { isSyncLabelActive, t } from "../i18n";
import { accountApi, parseBackendError } from "../services/backendClient";
import type { MailAiAction } from "../types/mailAi";
import type { useAiStore } from "./useAiStore";
import type { useMailStore } from "./useMailStore";
import type { useToasts } from "./useToasts";
import type { useWorkspaceStore } from "./useWorkspaceStore";

export function useAppActions(
  workspace: ReturnType<typeof useWorkspaceStore>,
  mailStore: ReturnType<typeof useMailStore>,
  aiStore: ReturnType<typeof useAiStore>,
  toastStore: ReturnType<typeof useToasts>,
) {
  const { refreshUnreadView } = mailStore;

  const triggerSyncAll = useCallback(() => {
    if (
      workspace.accounts.length === 0 ||
      isSyncLabelActive(workspace.syncLabel)
    ) {
      return;
    }
    const count = workspace.accounts.length;
    workspace.setSyncLabel(t("topbar.syncingAccounts", { count }));
    const minSpin = new Promise((r) => window.setTimeout(r, 420));
    void Promise.all([
      accountApi
        .triggerSync("")
        .then(() => workspace.refreshProfilesAndAccounts()),
      minSpin,
    ])
      .then(([, prof]) => {
        refreshUnreadView();
        void prof;
        workspace.setSyncLabel(t("topbar.allAccountsSynced"));
        toastStore.pushToast({
          tone: "success",
          title: t("toasts.syncAllDone", { count }),
        });
      })
      .catch((err) => {
        workspace.setSyncLabel(t("topbar.syncPartialFailed"));
        toastStore.pushToast({
          tone: "warning",
          title: t("toasts.syncProblem"),
          detail: parseBackendError(err).message,
        });
      });
  }, [workspace, toastStore, refreshUnreadView]);

  const triggerSyncAccount = useCallback(
    (accountId: string) => {
      if (!accountId) return;
      workspace.updateAccount(accountId, { status: "syncing" });
      workspace.setSyncLabel(t("topbar.syncingEllipsis"));
      void accountApi
        .triggerSync(accountId)
        .then(() => workspace.refreshProfilesAndAccounts())
        .then(() => refreshUnreadView())
        .catch((err) => {
          toastStore.pushToast({
            tone: "warning",
            title: t("toasts.syncProblem"),
            detail: parseBackendError(err).message,
          });
        });
    },
    [workspace, toastStore, refreshUnreadView],
  );

  const requestAiAction = useCallback(
    (actionLabel: string, action: MailAiAction) => {
      const cur = mailStore.selectedMail;
      if (
        !cur ||
        !workspace.settings.aiEnabled ||
        aiStore.result.status === "processing"
      ) {
        return;
      }
      workspace.setLeftNavOpen(false);
      aiStore.setAiOpen(true);
      if (
        cur.folder === "spam" ||
        cur.folder === "trash" ||
        cur.securityWarning?.level === "danger" ||
        aiStore.sensitive.has(cur.id)
      ) {
        return;
      }
      if (workspace.settings.aiRequireConfirmEachTime) {
        workspace.setOverlay({
          type: "ai-consent",
          actionLabel,
          action,
          mailId: cur.id,
          profileId: workspace.activeProfileId,
        });
      } else {
        aiStore.runAction(cur.id, action, false);
      }
    },
    [mailStore.selectedMail, workspace, aiStore],
  );

  return { triggerSyncAll, triggerSyncAccount, requestAiAction };
}

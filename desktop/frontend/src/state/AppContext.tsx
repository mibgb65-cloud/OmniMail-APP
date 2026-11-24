import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { isSyncLabelActive, t } from "../i18n";
import { accountApi, parseBackendError } from "../services/backendClient";
import type { MailAiAction } from "../types/mailAi";
import { useAiStore } from "./useAiStore";
import { useComposeStore } from "./useComposeStore";
import { useDesktopBridge } from "./useDesktopBridge";
import { useMailStore } from "./useMailStore";
import { useSendMailAction } from "./useSendMailAction";
import { useGlobalShortcuts } from "./useShortcuts";
import { useToasts } from "./useToasts";
import { useViewportMode } from "./useViewportMode";
import { useWorkspaceStore } from "./useWorkspaceStore";

export type AppContextValue = ReturnType<typeof useAppController>;

const AppContext = createContext<AppContextValue | null>(null);

function useAppController() {
  const viewport = useViewportMode();
  const workspace = useWorkspaceStore();
  const mailStore = useMailStore(workspace.settings.blockRemoteImages);
  const { refreshAfterMailDelta, refreshUnreadView } = mailStore;
  const aiStore = useAiStore();
  const toastStore = useToasts();
  const composeStore = useComposeStore(
    workspace.accounts,
    workspace.settings.defaultSendAccountId,
    `${workspace.activeProfileId}:${mailStore.selectedMail?.id ?? ""}`,
  );

  const { leftNavOpen, setLeftNavOpen } = workspace;
  useEffect(() => {
    if (viewport !== "compact" && leftNavOpen) setLeftNavOpen(false);
  }, [viewport, leftNavOpen, setLeftNavOpen]);

  const triggerSyncAll = useCallback(() => {
    if (
      workspace.accounts.length === 0 ||
      isSyncLabelActive(workspace.syncLabel)
    )
      return;
    const count = workspace.accounts.length;
    workspace.setSyncLabel(t("topbar.syncingAccounts", { count }));
    const minSpin = new Promise((r) => window.setTimeout(r, 420));
    void Promise.all([
      accountApi
        .triggerSync("")
        .then(() => workspace.refreshProfilesAndAccounts()),
      minSpin,
    ])
      .then(() => {
        refreshUnreadView();
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

  const onResetStoresForSwitch = useCallback(() => {
    workspace.clearCollections();
    mailStore.resetMailState();
    composeStore.closeDraft();
    aiStore.reset();
  }, [aiStore, composeStore, mailStore, workspace]);

  const desktopBridge = useDesktopBridge({
    settings: workspace.settings,
    applySettingsFromBackend: workspace.applySettingsFromBackend,
    setScreen: workspace.setScreen,
    setOverlay: workspace.setOverlay,
    setBannerMode: workspace.setBannerMode,
    setSyncLabel: workspace.setSyncLabel,
    updateAccount: workspace.updateAccount,
    refreshProfilesAndAccounts: workspace.refreshProfilesAndAccounts,
    onResetStoresForSwitch,
    onMailDelta: (addedIds) => {
      refreshAfterMailDelta(addedIds);
      void workspace.refreshProfilesAndAccounts();
    },
    openNewCompose: composeStore.openNewCompose,
    updateComposeDraft: composeStore.updateDraft,
    pushToast: toastStore.pushToast,
    onTraySyncAll: triggerSyncAll,
  });

  const sendMailWithUndo = useSendMailAction(
    workspace.accounts,
    workspace.settings.undoSendSeconds,
    mailStore,
    composeStore,
    toastStore,
  );

  const requestAiAction = useCallback(
    (actionLabel: string, action: MailAiAction) => {
      const cur = mailStore.selectedMail;
      if (
        !cur ||
        !workspace.settings.aiEnabled ||
        aiStore.result.status === "processing"
      )
        return;
      workspace.setLeftNavOpen(false);
      aiStore.setAiOpen(true);
      if (
        cur.folder === "spam" ||
        cur.folder === "trash" ||
        cur.securityWarning?.level === "danger" ||
        aiStore.sensitive.has(cur.id)
      )
        return;
      if (workspace.settings.aiRequireConfirmEachTime) {
        workspace.setOverlay({
          type: "ai-consent",
          actionLabel,
          action,
          mailId: cur.id,
          profileId: workspace.activeProfileId,
        });
      } else aiStore.runAction(cur.id, action, false);
    },
    [mailStore.selectedMail, workspace, aiStore],
  );

  useGlobalShortcuts({
    onOpenPalette: () => workspace.setOverlay({ type: "command-palette" }),
    onNewCompose: () => composeStore.openNewCompose(),
    onOpenSettings: () =>
      workspace.setOverlay({ type: "settings", tab: "general" }),
    onToggleTheme: workspace.toggleTheme,
    onToggleAi: () => {
      workspace.setLeftNavOpen(false);
      aiStore.setAiOpen((v) => !v);
    },
    onSyncAll: triggerSyncAll,
    onStepMail: (delta) => {
      if (workspace.screen !== "mail" || mailStore.filteredMails.length === 0)
        return;
      const list = mailStore.filteredMails;
      const idx = list.findIndex((m) => m.id === mailStore.selectedMail?.id);
      const next = list[Math.max(0, Math.min(list.length - 1, idx + delta))];
      if (next && next.id !== mailStore.selectedMail?.id)
        mailStore.openMail(next.id);
    },
    onEscape: () => {
      if (workspace.overlay.type !== "none")
        workspace.setOverlay({ type: "none" });
      else if (composeStore.draft && !composeStore.draft.minimized)
        composeStore.updateDraft({ minimized: true });
      else if (workspace.leftNavOpen) workspace.setLeftNavOpen(false);
      else if (aiStore.aiOpen) aiStore.setAiOpen(false);
    },
    overlay: workspace.overlay,
    composeOpen: Boolean(composeStore.draft && !composeStore.draft.minimized),
  });

  return {
    viewport,
    workspace,
    desktopBridge,
    mailStore,
    composeStore,
    aiStore,
    toastStore,
    triggerSyncAll,
    sendMailWithUndo,
    requestAiAction,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AppContext.Provider value={useAppController()}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp 必须在 AppProvider 内调用");
  return ctx;
}

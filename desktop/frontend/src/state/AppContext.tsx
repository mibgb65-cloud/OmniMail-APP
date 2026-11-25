import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useAiStore } from "./useAiStore";
import { useAppActions } from "./useAppActions";
import { useComposeStore } from "./useComposeStore";
import { useDesktopBridge } from "./useDesktopBridge";
import { useMailStore } from "./useMailStore";
import { useMuseMailStore } from "./useMuseMailStore";
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
  const { refreshAfterMailDelta } = mailStore;
  const aiStore = useAiStore();
  const toastStore = useToasts();
  const museStore = useMuseMailStore(
    workspace.activeProfileId,
    workspace.screen,
    workspace.setScreen,
    toastStore.pushToast,
  );
  const composeStore = useComposeStore(
    workspace.accounts,
    workspace.settings.defaultSendAccountId,
    `${workspace.activeProfileId}:${mailStore.selectedMail?.id ?? ""}`,
  );

  const { leftNavOpen, setLeftNavOpen, overlay } = workspace;
  const { resetForWorkspaceSwitch } = museStore;
  useEffect(() => {
    if (viewport !== "compact" && leftNavOpen) setLeftNavOpen(false);
  }, [viewport, leftNavOpen, setLeftNavOpen]);

  useEffect(() => {
    if (overlay.type === "profile-manage" && overlay.mode === "unlock") {
      resetForWorkspaceSwitch();
    }
  }, [overlay, resetForWorkspaceSwitch]);

  const { triggerSyncAll, requestAiAction } = useAppActions(
    workspace,
    mailStore,
    aiStore,
    toastStore,
  );

  const onResetStoresForSwitch = useCallback(() => {
    workspace.clearCollections();
    mailStore.resetMailState();
    composeStore.closeDraft();
    aiStore.reset();
    resetForWorkspaceSwitch();
  }, [aiStore, composeStore, mailStore, resetForWorkspaceSwitch, workspace]);

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

  useGlobalShortcuts({
    onOpenPalette: () => workspace.setOverlay({ type: "command-palette" }),
    onNewCompose: () => composeStore.openNewCompose(),
    onOpenSettings: () =>
      workspace.setOverlay({ type: "settings", tab: "general" }),
    onToggleTheme: workspace.toggleTheme,
    onToggleAi: () => {
      if (workspace.screen !== "mail") return;
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
    museStore,
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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { accountApi, parseBackendError } from "../services/backendClient";
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
  const aiStore = useAiStore();
  const toastStore = useToasts();
  const composeStore = useComposeStore(
    workspace.accounts,
    workspace.settings.defaultSendAccountId,
  );

  const { leftNavOpen, setLeftNavOpen } = workspace;
  useEffect(() => {
    if (viewport !== "compact" && leftNavOpen) setLeftNavOpen(false);
  }, [viewport, leftNavOpen, setLeftNavOpen]);

  const triggerSyncAll = useCallback(() => {
    if (workspace.accounts.length === 0) return;
    if (workspace.syncLabel.startsWith("正在同步")) return;
    workspace.setSyncLabel(`正在同步 ${workspace.accounts.length} 个邮箱…`);
    const minSpin = new Promise((r) => window.setTimeout(r, 420));
    void Promise.all([
      accountApi
        .triggerSync("")
        .then(() => workspace.refreshProfilesAndAccounts()),
      minSpin,
    ])
      .then(() => {
        workspace.setSyncLabel("所有邮箱已同步");
        toastStore.pushToast({
          tone: "success",
          title: `已完成 ${workspace.accounts.length} 个邮箱同步`,
        });
      })
      .catch((err) => {
        workspace.setSyncLabel("同步部分受阻");
        toastStore.pushToast({
          tone: "warning",
          title: "同步邮箱时遇到问题",
          detail: parseBackendError(err).message,
        });
      });
  }, [workspace, toastStore]);

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
    onMailDelta: (counts) => {
      if (counts) mailStore.setFolderCounts(counts);
      void mailStore.reloadMessages();
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
    (actionLabel: string, prompt: string) => {
      const cur = mailStore.selectedMail;
      if (
        !cur ||
        !workspace.settings.aiEnabled ||
        aiStore.aiStatus === "processing"
      )
        return;
      if (
        cur.folder === "spam" ||
        cur.folder === "trash" ||
        cur.securityWarning?.level === "danger"
      ) {
        toastStore.pushToast({
          tone: "warning",
          title: "已按隐私规则拦截敏感邮件 AI 读取",
        });
        return;
      }
      workspace.setLeftNavOpen(false);
      aiStore.setAiOpen(true);
      if (workspace.settings.aiRequireConfirmEachTime) {
        workspace.setOverlay({
          type: "ai-consent",
          actionLabel,
          onConfirmPrompt: prompt,
          mailId: cur.id,
        });
      } else aiStore.runPrompt(cur, prompt, false);
    },
    [mailStore.selectedMail, workspace, aiStore, toastStore],
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

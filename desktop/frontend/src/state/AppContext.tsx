import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { createSentMailItem, type SendMailPayload } from "./mailFactory";
import { useAiStore } from "./useAiStore";
import { useComposeStore } from "./useComposeStore";
import { useMailStore } from "./useMailStore";
import { useGlobalShortcuts } from "./useShortcuts";
import { useToasts } from "./useToasts";
import { useViewportMode } from "./useViewportMode";
import { useWorkspaceStore } from "./useWorkspaceStore";

export type AppContextValue = ReturnType<typeof useAppController>;

const AppContext = createContext<AppContextValue | null>(null);

function useAppController() {
  const viewport = useViewportMode();
  const workspace = useWorkspaceStore();
  const mailStore = useMailStore();
  const aiStore = useAiStore();
  const toastStore = useToasts();
  const composeStore = useComposeStore(
    workspace.accounts,
    workspace.settings.defaultSendAccountId,
  );

  const { leftNavOpen, setLeftNavOpen } = workspace;
  useEffect(() => {
    if (viewport !== "compact" && leftNavOpen) {
      setLeftNavOpen(false);
    }
  }, [viewport, leftNavOpen, setLeftNavOpen]);

  const triggerSyncAll = useCallback(() => {
    workspace.setSyncLabel("正在同步全部邮箱…");
    window.setTimeout(() => {
      workspace.setSyncLabel("所有邮箱已同步");
      toastStore.pushToast({
        tone: "success",
        title: "全部 4 个邮箱已完成同步",
        detail: "未发现新错误 · 本地搜索索引已刷新",
      });
    }, 600);
  }, [workspace, toastStore]);

  const sendMailWithUndo = useCallback(
    (payload: SendMailPayload) => {
      const account =
        workspace.accounts.find((a) => a.id === payload.accountId) ??
        workspace.accounts[0];
      const created = createSentMailItem(account, payload);

      mailStore.addMail(created);
      toastStore.pushToast(
        {
          tone: "success",
          title: payload.scheduledAt
            ? `已加入定时发送队列（${payload.scheduledAt}）`
            : `正在通过 ${account?.shortTag ?? "工作 · Gmail"} 发送…`,
          detail: `${workspace.settings.undoSendSeconds} 秒内可撤销发送并返回草稿继续编辑`,
          actionLabel: "撤销发送",
          onAction: () => {
            mailStore.permanentDelete([created.id]);
            composeStore.openNewCompose(payload.to);
            composeStore.updateDraft({
              subject: payload.subject,
              body: payload.body,
            });
          },
        },
        workspace.settings.undoSendSeconds * 1000,
      );
    },
    [
      workspace.accounts,
      workspace.settings.undoSendSeconds,
      mailStore,
      toastStore,
      composeStore,
    ],
  );

  const requestAiAction = useCallback(
    (actionLabel: string, prompt: string) => {
      const current = mailStore.selectedMail;
      if (!current) return;
      if (
        current.folder === "spam" ||
        current.folder === "trash" ||
        current.securityWarning
      ) {
        toastStore.pushToast({
          tone: "warning",
          title: "当前邮件已禁用 Omni AI 读取",
          detail: "垃圾邮件、回收站与疑似钓鱼邮件不会发送至 AI 模型。",
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
        });
      } else {
        aiStore.runPrompt(current, prompt);
      }
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
    onEscape: () => {
      if (workspace.overlay.type !== "none") {
        workspace.setOverlay({ type: "none" });
      } else if (composeStore.draft && !composeStore.draft.minimized) {
        composeStore.updateDraft({ minimized: true });
      } else if (workspace.leftNavOpen) {
        workspace.setLeftNavOpen(false);
      } else if (aiStore.aiOpen) {
        aiStore.setAiOpen(false);
      }
    },
    overlay: workspace.overlay,
  });

  return useMemo(
    () => ({
      viewport,
      workspace,
      mailStore,
      composeStore,
      aiStore,
      toastStore,
      triggerSyncAll,
      sendMailWithUndo,
      requestAiAction,
    }),
    [
      viewport,
      workspace,
      mailStore,
      composeStore,
      aiStore,
      toastStore,
      triggerSyncAll,
      sendMailWithUndo,
      requestAiAction,
    ],
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppController();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp 必须在 AppProvider 内调用");
  return ctx;
}

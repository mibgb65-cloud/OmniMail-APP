import { useRef, type CSSProperties, type MouseEvent } from "react";
import { MailAiSidebar } from "./components/ai/MailAiSidebar";
import { useAiPanelResize } from "./components/ai/useAiPanelResize";
import { ToastStack } from "./components/common/ToastStack";
import { ComposeDock } from "./components/compose/ComposeDock";
import { ComposeModal } from "./components/compose/ComposeModal";
import { ContactsSidebar } from "./components/contacts/ContactsSidebar";
import { DuplicateCenter } from "./components/contacts/duplicates/DuplicateCenter";
import { useContactsNavState } from "./components/contacts/ContactsWorkspace";
import { TranslationProvider } from "./components/mail/translation/TranslationContext";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { OverlayRouter } from "./components/overlays/OverlayRouter";
import { LaunchSplash } from "./components/shell/LaunchSplash";
import { LeftNavDrawer } from "./components/shell/LeftNavDrawer";
import { Sidebar } from "./components/shell/Sidebar";
import { StatusBanner } from "./components/shell/StatusBanner";
import { TopBar } from "./components/shell/TopBar";
import {
  resolveStageRoute,
  WorkspaceStageSlot,
} from "./components/shell/WorkspaceStageSlot";
import { useI18n } from "./i18n";
import { AppProvider, useApp } from "./state/AppContext";
import { useLaunchSplash } from "./state/useLaunchSplash";
import { usePresence } from "./state/usePresence";

function blockChromeContextMenu(e: MouseEvent<HTMLElement>) {
  const el = e.target as HTMLElement | null;
  if (el?.closest("input, textarea, [contenteditable='true']")) return;
  e.preventDefault();
}

function OmniMailShell() {
  const { viewport, workspace, aiStore, toastStore } = useApp();
  const { t } = useI18n();
  const contactsNav = useContactsNavState();
  const splash = useLaunchSplash(workspace.accounts.length);
  const activeRoute = resolveStageRoute(workspace.screen);

  const isMailScreen = workspace.screen === "mail";
  const dockAi = isMailScreen && viewport === "wide";
  const stageRef = useRef<HTMLDivElement>(null);
  const aiPanel = useAiPanelResize(stageRef, dockAi, isMailScreen);
  const showLeftDrawer =
    (isMailScreen ||
      workspace.screen === "muse" ||
      workspace.screen === "workbuddy") &&
    viewport === "compact" &&
    workspace.leftNavOpen;
  const leftDrawer = usePresence(showLeftDrawer, 180);
  const isOnboarding = workspace.screen === "onboarding";

  return (
    <div onContextMenu={blockChromeContextMenu}>
      <div
        className="app-boot-stage"
        data-splash-state={splash.workspaceSplashState}
      >
        {isOnboarding ? (
          <OnboardingScreen />
        ) : (
          <div
            className="app-shell"
            data-density={workspace.settings.density}
            data-viewport={viewport}
          >
            <TopBar />
            <StatusBanner />
            <div
              ref={stageRef}
              id="workspace-stage"
              className="workspace-stage"
              data-ai-resizing={aiPanel.isResizing}
              style={
                { "--ai-slide-width": `${aiPanel.width}px` } as CSSProperties
              }
            >
              <main
                className="workspace-grid"
                aria-label={t("common.mainWorkspace")}
              >
                {activeRoute === "contacts" ? (
                  <ContactsSidebar {...contactsNav} />
                ) : (
                  <Sidebar />
                )}
                <WorkspaceStageSlot
                  activeRoute={activeRoute}
                  contactsNav={contactsNav}
                  aiDocked={dockAi ? aiStore.aiOpen : undefined}
                />
              </main>

              {leftDrawer.mounted && (
                <LeftNavDrawer closing={leftDrawer.closing} />
              )}
              {isMailScreen && (
                <MailAiSidebar
                  open={aiStore.aiOpen}
                  isDrawer={!dockAi}
                  resize={aiPanel.separator}
                />
              )}
            </div>
          </div>
        )}
        {!isOnboarding && (
          <>
            <ComposeModal />
            <ComposeDock />
          </>
        )}
        <OverlayRouter />
        <ToastStack
          toasts={toastStore.toasts}
          onDismiss={toastStore.dismissToast}
          onPause={toastStore.pauseToast}
          onResume={toastStore.resumeToast}
        />
      </div>
      {splash.phase !== "done" && (
        <LaunchSplash
          waiting={splash.phase === "waiting"}
          exiting={splash.phase === "exiting"}
          progress={splash.progress}
          isSlowLoad={splash.isSlowLoad}
          statusText={splash.statusText}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <TranslationProvider>
        <DuplicateCenter>
          <OmniMailShell />
        </DuplicateCenter>
      </TranslationProvider>
    </AppProvider>
  );
}

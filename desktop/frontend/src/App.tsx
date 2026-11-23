import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { MailAiSidebar } from "./components/ai/MailAiSidebar";
import { useAiPanelResize } from "./components/ai/useAiPanelResize";
import { ToastStack } from "./components/common/ToastStack";
import { ComposeDock } from "./components/compose/ComposeDock";
import { ComposeModal } from "./components/compose/ComposeModal";
import { ContactsSidebar } from "./components/contacts/ContactsSidebar";
import { DuplicateCenter } from "./components/contacts/duplicates/DuplicateCenter";
import {
  ContactsWorkspace,
  useContactsNavState,
} from "./components/contacts/ContactsWorkspace";
import { MailListPane } from "./components/mail/MailListPane";
import { MailReaderPane } from "./components/mail/reader/MailReaderPane";
import { TranslationProvider } from "./components/mail/translation/TranslationContext";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { OverlayRouter } from "./components/overlays/OverlayRouter";
import { LaunchSplash } from "./components/shell/LaunchSplash";
import { LeftNavDrawer } from "./components/shell/LeftNavDrawer";
import { Sidebar } from "./components/shell/Sidebar";
import { StatusBanner } from "./components/shell/StatusBanner";
import { TopBar } from "./components/shell/TopBar";
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
  const contactsNav = useContactsNavState();
  const splash = useLaunchSplash(workspace.accounts.length);

  const activeRoute: "mail" | "contacts" =
    workspace.screen === "contacts" ? "contacts" : "mail";
  const [prevRoute, setPrevRoute] = useState<"mail" | "contacts">(activeRoute);
  const [routeDir, setRouteDir] = useState<"fwd" | "back" | undefined>(
    undefined,
  );
  const [exitingRoute, setExitingRoute] = useState<"mail" | "contacts" | null>(
    null,
  );

  if (activeRoute !== prevRoute) {
    setRouteDir(activeRoute === "contacts" ? "fwd" : "back");
    setExitingRoute(prevRoute);
    setPrevRoute(activeRoute);
  }

  useEffect(() => {
    if (!exitingRoute) return;
    const timer = window.setTimeout(() => setExitingRoute(null), 80);
    return () => window.clearTimeout(timer);
  }, [exitingRoute]);

  const isMailScreen = workspace.screen === "mail";
  const dockAi = isMailScreen && viewport === "wide";
  const stageRef = useRef<HTMLDivElement>(null);
  const aiPanel = useAiPanelResize(stageRef, dockAi, isMailScreen);
  const showLeftDrawer =
    isMailScreen && viewport === "compact" && workspace.leftNavOpen;

  const leftDrawer = usePresence(showLeftDrawer, 180);

  const isOnboarding = workspace.screen === "onboarding";
  const shellContent = isOnboarding ? (
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
        style={{ "--ai-slide-width": `${aiPanel.width}px` } as CSSProperties}
      >
        <main className="workspace-grid" aria-label="主工作空间">
          {activeRoute === "contacts" ? (
            <ContactsSidebar {...contactsNav} />
          ) : (
            <Sidebar />
          )}

          <div className="route-slot-wrap">
            {exitingRoute && (
              <div className="route-exit-layer" aria-hidden="true">
                {exitingRoute === "contacts" ? (
                  <ContactsWorkspace nav={contactsNav} readOnlyExit />
                ) : (
                  <>
                    <MailListPane readOnlyExit />
                    <MailReaderPane />
                  </>
                )}
              </div>
            )}

            <div
              key={activeRoute}
              className="route-main-stage"
              data-dir={routeDir}
              data-ai-docked={dockAi ? aiStore.aiOpen : undefined}
            >
              {activeRoute === "contacts" ? (
                <ContactsWorkspace nav={contactsNav} />
              ) : (
                <>
                  <MailListPane />
                  <MailReaderPane />
                </>
              )}
            </div>
          </div>
        </main>

        {leftDrawer.mounted && <LeftNavDrawer closing={leftDrawer.closing} />}
        {isMailScreen && (
          <MailAiSidebar
            open={aiStore.aiOpen}
            isDrawer={!dockAi}
            resize={aiPanel.separator}
          />
        )}
      </div>
    </div>
  );

  return (
    <div onContextMenu={blockChromeContextMenu}>
      <div
        className="app-boot-stage"
        data-splash-state={splash.workspaceSplashState}
      >
        {shellContent}
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

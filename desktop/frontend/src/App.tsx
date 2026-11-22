import { AiPane } from "./components/ai/AiPane";
import { ToastStack } from "./components/common/ToastStack";
import { ComposeDock } from "./components/compose/ComposeDock";
import { ComposeModal } from "./components/compose/ComposeModal";
import { ContactsWorkspace } from "./components/contacts/ContactsWorkspace";
import { MailListPane } from "./components/mail/MailListPane";
import { MailReaderPane } from "./components/mail/reader/MailReaderPane";
import { OnboardingScreen } from "./components/onboarding/OnboardingScreen";
import { OverlayRouter } from "./components/overlays/OverlayRouter";
import { LeftNavDrawer } from "./components/shell/LeftNavDrawer";
import { Sidebar } from "./components/shell/Sidebar";
import { StatusBanner } from "./components/shell/StatusBanner";
import { TopBar } from "./components/shell/TopBar";
import { AppProvider, useApp } from "./state/AppContext";

function OmniMailShell() {
  const { viewport, workspace, aiStore, toastStore } = useApp();

  if (workspace.screen === "onboarding") {
    return (
      <>
        <OnboardingScreen />
        <OverlayRouter />
        <ToastStack
          toasts={toastStore.toasts}
          onDismiss={toastStore.dismissToast}
        />
      </>
    );
  }

  const isMailScreen = workspace.screen === "mail";
  const showInlineAi = isMailScreen && aiStore.aiOpen && viewport === "wide";
  const showDrawerAi = isMailScreen && aiStore.aiOpen && viewport !== "wide";
  const showLeftDrawer =
    isMailScreen && viewport === "compact" && workspace.leftNavOpen;

  return (
    <div
      className="app-shell"
      data-density={workspace.settings.density}
      data-viewport={viewport}
    >
      <TopBar />
      <StatusBanner />

      <div className="workspace-stage">
        {workspace.screen === "contacts" ? (
          <ContactsWorkspace />
        ) : (
          <main className="workspace-grid" aria-label="邮件工作空间">
            <Sidebar />
            <MailListPane />
            <MailReaderPane />
            {showInlineAi && <AiPane />}
          </main>
        )}

        {showLeftDrawer && <LeftNavDrawer />}
        {showDrawerAi && <AiPane isDrawer />}
      </div>

      <ComposeModal />
      <ComposeDock />
      <OverlayRouter />
      <ToastStack
        toasts={toastStore.toasts}
        onDismiss={toastStore.dismissToast}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <OmniMailShell />
    </AppProvider>
  );
}

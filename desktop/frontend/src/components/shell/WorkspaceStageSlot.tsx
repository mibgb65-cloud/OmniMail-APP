import { useEffect, useState } from "react";
import type { WorkspaceScreen } from "../../types/ui";
import {
  ContactsWorkspace,
  type useContactsNavState,
} from "../contacts/ContactsWorkspace";
import { MailListPane } from "../mail/MailListPane";
import { MailReaderPane } from "../mail/reader/MailReaderPane";
import { MuseMailView } from "../muse/MuseMailView";

export type StageRoute = "mail" | "contacts" | "muse";

export function resolveStageRoute(screen: WorkspaceScreen): StageRoute {
  if (screen === "contacts") return "contacts";
  if (screen === "muse") return "muse";
  return "mail";
}

function renderStageContent(
  route: StageRoute,
  contactsNav: ReturnType<typeof useContactsNavState>,
  readOnlyExit = false,
) {
  if (route === "contacts") {
    return <ContactsWorkspace nav={contactsNav} readOnlyExit={readOnlyExit} />;
  }
  if (route === "muse") {
    return <MuseMailView readOnlyExit={readOnlyExit} />;
  }
  return (
    <>
      <MailListPane readOnlyExit={readOnlyExit} />
      <MailReaderPane />
    </>
  );
}

export function WorkspaceStageSlot({
  activeRoute,
  contactsNav,
  aiDocked,
}: {
  activeRoute: StageRoute;
  contactsNav: ReturnType<typeof useContactsNavState>;
  aiDocked?: boolean;
}) {
  const [prevRoute, setPrevRoute] = useState<StageRoute>(activeRoute);
  const [routeDir, setRouteDir] = useState<"fwd" | "back" | undefined>();
  const [exitingRoute, setExitingRoute] = useState<StageRoute | null>(null);

  if (activeRoute !== prevRoute) {
    setRouteDir(activeRoute === "mail" ? "back" : "fwd");
    setExitingRoute(prevRoute);
    setPrevRoute(activeRoute);
  }

  useEffect(() => {
    if (!exitingRoute) return;
    const timer = window.setTimeout(() => setExitingRoute(null), 80);
    return () => window.clearTimeout(timer);
  }, [exitingRoute]);

  return (
    <div className="route-slot-wrap">
      {exitingRoute && (
        <div className="route-exit-layer" aria-hidden="true">
          {renderStageContent(exitingRoute, contactsNav, true)}
        </div>
      )}
      <div
        key={activeRoute}
        className="route-main-stage"
        data-dir={routeDir}
        data-ai-docked={aiDocked}
      >
        {renderStageContent(activeRoute, contactsNav)}
      </div>
    </div>
  );
}

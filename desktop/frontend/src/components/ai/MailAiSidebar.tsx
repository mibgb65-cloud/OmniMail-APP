import { useLayoutEffect, useRef } from "react";
import { useApp } from "../../state/AppContext";
import { AiPane } from "./AiPane";

function focusAiToggle() {
  document.getElementById("mail-ai-toggle")?.focus({ preventScroll: true });
}

export function MailAiSidebar({
  open,
  isDrawer,
}: {
  open: boolean;
  isDrawer: boolean;
}) {
  const { aiStore } = useApp();
  const layerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open && layerRef.current?.contains(document.activeElement)) {
      focusAiToggle();
    }
  }, [open]);

  const close = () => {
    focusAiToggle();
    aiStore.setAiOpen(false);
  };

  return (
    <div
      ref={layerRef}
      className="workspace-drawer-layer ai-slide-layer"
      data-open={open}
      data-placement={isDrawer ? "drawer" : "docked"}
      inert={!open}
      role={isDrawer ? "dialog" : undefined}
      aria-label={isDrawer ? "Omni AI 浮层抽屉" : undefined}
    >
      {isDrawer && (
        <div className="ai-slide-scrim" aria-hidden="true" onClick={close} />
      )}
      <AiPane isDrawer={isDrawer} open={open} onClose={close} />
    </div>
  );
}

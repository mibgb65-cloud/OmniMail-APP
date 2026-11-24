import { useLayoutEffect, useRef } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { AiPane } from "./AiPane";
import type { AiResizeHandleProps } from "./AiResizeHandle";

function focusAiToggle() {
  document.getElementById("mail-ai-toggle")?.focus({ preventScroll: true });
}

export function MailAiSidebar({
  open,
  isDrawer,
  resize,
}: {
  open: boolean;
  isDrawer: boolean;
  resize: AiResizeHandleProps;
}) {
  const { t } = useI18n();
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
      aria-label={isDrawer ? t("ai.drawerAria") : undefined}
    >
      {isDrawer && (
        <div className="ai-slide-scrim" aria-hidden="true" onClick={close} />
      )}
      <AiPane isDrawer={isDrawer} open={open} onClose={close} resize={resize} />
    </div>
  );
}

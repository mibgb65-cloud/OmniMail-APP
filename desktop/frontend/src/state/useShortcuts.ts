import { useEffect } from "react";
import type { OverlayModal } from "../types/ui";

interface ShortcutHandlers {
  onOpenPalette: () => void;
  onNewCompose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onToggleAi: () => void;
  onSyncAll: () => void;
  onStepMail: (delta: -1 | 1) => void;
  onOpenLabelPicker?: () => void;
  onEscape: () => void;
  overlay: OverlayModal;
  composeOpen: boolean;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const lower = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && lower === "k") {
        e.preventDefault();
        handlers.onOpenPalette();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        handlers.onOpenSettings();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && lower === "t") {
        e.preventDefault();
        handlers.onToggleTheme();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && lower === "n" && !isEditing) {
        e.preventDefault();
        handlers.onNewCompose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && lower === "r" && !isEditing) {
        e.preventDefault();
        handlers.onSyncAll();
        return;
      }
      if (e.altKey && lower === "a") {
        e.preventDefault();
        handlers.onToggleAi();
        return;
      }
      if (e.key === "Escape") {
        handlers.onEscape();
        return;
      }

      if (
        !isEditing &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        handlers.overlay.type === "none" &&
        !handlers.composeOpen
      ) {
        if (lower === "j") {
          e.preventDefault();
          handlers.onStepMail(1);
        } else if (lower === "k") {
          e.preventDefault();
          handlers.onStepMail(-1);
        } else if (lower === "c") {
          e.preventDefault();
          handlers.onNewCompose();
        } else if (lower === "l" && handlers.onOpenLabelPicker) {
          e.preventDefault();
          handlers.onOpenLabelPicker();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}

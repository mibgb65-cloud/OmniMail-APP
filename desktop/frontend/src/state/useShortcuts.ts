import { useEffect } from "react";
import type { OverlayModal } from "../types/ui";

interface ShortcutHandlers {
  onOpenPalette: () => void;
  onNewCompose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onToggleAi: () => void;
  onSyncAll: () => void;
  onEscape: () => void;
  overlay: OverlayModal;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlers.onOpenPalette();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        handlers.onOpenSettings();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "t"
      ) {
        e.preventDefault();
        handlers.onToggleTheme();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "n" &&
        !isEditing
      ) {
        e.preventDefault();
        handlers.onNewCompose();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "r" &&
        !isEditing
      ) {
        e.preventDefault();
        handlers.onSyncAll();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handlers.onToggleAi();
        return;
      }
      if (e.key === "Escape") {
        handlers.onEscape();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}

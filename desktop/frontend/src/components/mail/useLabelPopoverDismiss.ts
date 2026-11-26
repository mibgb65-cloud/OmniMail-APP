import { useEffect, type RefObject } from "react";

interface UseLabelPopoverDismissOptions {
  panelRef: RefObject<HTMLElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  anchorEl?: HTMLElement | null;
  disabled?: boolean;
  selectOnFocus?: boolean;
  watchScroll?: boolean;
  onClose: () => void;
}

export function useLabelPopoverDismiss({
  panelRef,
  inputRef,
  anchorEl,
  disabled = false,
  selectOnFocus = false,
  watchScroll = false,
  onClose,
}: UseLabelPopoverDismissOptions) {
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      if (selectOnFocus) inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [inputRef, selectOnFocus]);

  useEffect(() => {
    if (disabled) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (panelRef.current?.contains(target) || anchorEl?.contains(target)) {
        return;
      }
      onClose();
    };
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        anchorEl?.focus({ preventScroll: true });
      }
    };
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) {
        return;
      }
      onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onClose);
    if (watchScroll) window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKeyCapture, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onClose);
      if (watchScroll) window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyCapture, true);
    };
  }, [anchorEl, disabled, onClose, panelRef, watchScroll]);
}

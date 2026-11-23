import { useLayoutEffect, type RefObject } from "react";

export function useTranslationAnchor(
  panel: RefObject<HTMLDivElement | null>,
  anchor: RefObject<HTMLDivElement | null>,
  onClose: (restoreFocus?: boolean) => void,
) {
  useLayoutEffect(() => {
    const el = panel.current;
    const trigger = anchor.current;
    if (!el || !trigger) return;
    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(330, window.innerWidth - 16);
      el.style.setProperty("width", `${width}px`);
      el.style.setProperty(
        "left",
        `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
      );
      el.style.setProperty("top", `${rect.bottom + 7}px`);
      el.style.setProperty(
        "max-height",
        `${Math.max(90, window.innerHeight - rect.bottom - 15)}px`,
      );
    };
    position();
    el.querySelector<HTMLElement>("select")?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(document.documentElement);
    const toolbar = trigger.closest(".reader-toolbar");
    if (toolbar) observer.observe(toolbar);
    const onPointerDown = (ev: PointerEvent) => {
      const path = ev.composedPath();
      if (!path.includes(el) && !path.includes(trigger)) onClose();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      onClose(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose, panel]);
}

import { useLayoutEffect, type RefObject } from "react";

export const TRANSLATION_INITIAL_FOCUS_SELECTOR =
  'button[role="combobox"], button, input';

const NESTED_SELECT_SELECTOR =
  '[data-omnimail-popover="select"], .custom-select-popover, .custom-select-menu, [role="listbox"]';

export function isTranslationPopoverLayerEvent(
  path: readonly EventTarget[],
  panel: EventTarget,
  trigger: EventTarget,
): boolean {
  return path.some((node) => {
    if (node === panel || node === trigger) return true;
    const candidate = node as { matches?: unknown };
    return (
      typeof candidate.matches === "function" &&
      (node as Element).matches(NESTED_SELECT_SELECTOR)
    );
  });
}

export function hasOpenNestedSelect(
  panel: ParentNode,
  root: ParentNode = panel.ownerDocument ?? document,
): boolean {
  return Boolean(
    panel.querySelector('[role="combobox"][aria-expanded="true"]') ||
    root.querySelector(
      '[data-omnimail-popover="select"]:not([data-closing="true"])',
    ),
  );
}

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
    el.querySelector<HTMLElement>(TRANSLATION_INITIAL_FOCUS_SELECTOR)?.focus({
      preventScroll: true,
    });
    const observer = new ResizeObserver(position);
    observer.observe(document.documentElement);
    const toolbar = trigger.closest(".reader-toolbar");
    if (toolbar) observer.observe(toolbar);
    const onPointerDown = (ev: PointerEvent) => {
      if (!isTranslationPopoverLayerEvent(ev.composedPath(), el, trigger)) {
        onClose();
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || hasOpenNestedSelect(el)) return;
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

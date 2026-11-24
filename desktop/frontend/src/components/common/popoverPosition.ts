import { useEffect, type RefObject } from "react";

export interface PopoverGeometry {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight?: number;
  side: "bottom" | "top";
}

export function computePopoverGeometry(
  triggerEl: HTMLElement,
  estHeight: number,
  minWidth = 176,
): PopoverGeometry {
  const r = triggerEl.getBoundingClientRect();
  const footerTop =
    triggerEl
      .closest(".modal-card")
      ?.querySelector(".modal-footer")
      ?.getBoundingClientRect().top ?? Infinity;
  const bottomLimit = Math.min(window.innerHeight - 14, footerTop - 6);
  const spaceBelow = bottomLimit - r.bottom - 6;
  const spaceAbove = r.top - 16;
  const flipUp = spaceBelow < estHeight && spaceAbove > spaceBelow;
  const maxWidth = Math.max(120, window.innerWidth - 20);
  const width = Math.min(Math.max(r.width, minWidth), maxWidth);
  const left = Math.max(10, Math.min(r.left, window.innerWidth - width - 10));
  const maxHeight = Math.max(
    120,
    Math.min(260, Math.floor(flipUp ? spaceAbove : spaceBelow)),
  );

  return flipUp
    ? {
        side: "top",
        left,
        width,
        maxHeight,
        bottom: window.innerHeight - r.top + 6,
      }
    : { side: "bottom", left, width, maxHeight, top: r.bottom + 6 };
}

export function buildCalendarCells(year: number, month: number) {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: Array<{ y: number; m: number; d: number; muted: boolean }> = [];

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ y: py, m: pm, d: prevMonthDays - i, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ y: year, m: month, d, muted: false });
  }
  while (cells.length % 7 !== 0) {
    const nd = cells.length - startOffset - daysInMonth + 1;
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ y: ny, m: nm, d: nd, muted: true });
  }
  return cells;
}

export function usePopoverDismiss(
  isOpen: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) {
        return;
      }
      onClose();
    };
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target))
        return;
      onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKeyCapture, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyCapture, true);
    };
  }, [isOpen, triggerRef, menuRef, onClose]);
}

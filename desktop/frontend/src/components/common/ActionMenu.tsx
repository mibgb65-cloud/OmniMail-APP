import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

export type ActionMenuEntry =
  | { type: "divider" }
  | {
      type?: "item";
      label: string;
      icon?: IconName;
      shortcut?: string;
      danger?: boolean;
      renderSubmenu?: (opts: {
        anchorRect: DOMRect;
        closeSubmenu: () => void;
      }) => ReactNode;
      onSelect: (triggerEl?: HTMLButtonElement) => void;
    };

interface ActionMenuProps {
  x: number;
  y: number;
  closing?: boolean;
  minWidth?: number;
  items: ActionMenuEntry[];
  onClose: () => void;
}

export function ActionMenu({
  x,
  y,
  closing = false,
  minWidth = 214,
  items,
  onClose,
}: ActionMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openSub, setOpenSub] = useState<{
    idx: number;
    rect: DOMRect;
  } | null>(null);

  useEffect(() => {
    if (closing) return;
    const insideMenuOrPicker = (target: EventTarget | null) => {
      const t = target as HTMLElement | null;
      return Boolean(
        menuRef.current?.contains(t) ||
        t?.closest?.('[data-omnimail-popover="label-picker"]'),
      );
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!insideMenuOrPicker(e.target)) onClose();
    };
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    const onScroll = (e: Event) => {
      if (!insideMenuOrPicker(e.target)) onClose();
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
  }, [closing, onClose]);

  const estHeight = items.length * 32 + 16;
  const flipUp = y + estHeight > window.innerHeight - 12 && y > estHeight + 16;
  const left = Math.max(10, Math.min(x, window.innerWidth - minWidth - 12));
  const top = flipUp
    ? Math.max(10, y - estHeight - 6)
    : Math.max(10, Math.min(y, window.innerHeight - estHeight - 12));

  const activeSubEntry =
    openSub !== null && items[openSub.idx]?.type !== "divider"
      ? (items[openSub.idx] as Extract<ActionMenuEntry, { label: string }>)
      : null;

  return createPortal(
    <>
      <div
        ref={menuRef}
        role="menu"
        data-side={flipUp ? "top" : "bottom"}
        data-closing={closing ? "true" : "false"}
        className="context-menu"
        style={{ left, top, minWidth }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          const btns = Array.from(
            menuRef.current?.querySelectorAll<HTMLButtonElement>(
              'button[role="menuitem"]',
            ) ?? [],
          );
          if (btns.length === 0) return;
          const cur = btns.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            btns[(cur + 1) % btns.length]?.focus();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            btns[(cur - 1 + btns.length) % btns.length]?.focus();
          }
        }}
      >
        {items.map((entry, idx) => {
          if (entry.type === "divider") {
            return <div key={`div-${idx}`} className="context-menu-divider" />;
          }
          const hasSub = Boolean(entry.renderSubmenu);
          const isSubOpen = hasSub && openSub?.idx === idx;
          return (
            <button
              key={entry.label}
              type="button"
              role="menuitem"
              aria-haspopup={hasSub ? "dialog" : undefined}
              aria-expanded={hasSub ? isSubOpen : undefined}
              className={`context-menu-item${entry.danger ? " danger" : ""}${isSubOpen ? " is-sub-open" : ""}`}
              onMouseEnter={(e) => {
                if (hasSub) {
                  setOpenSub({
                    idx,
                    rect: e.currentTarget.getBoundingClientRect(),
                  });
                } else if (openSub) {
                  setOpenSub(null);
                }
              }}
              onKeyDown={(e) => {
                if (hasSub && e.key === "ArrowRight") {
                  e.preventDefault();
                  setOpenSub({
                    idx,
                    rect: e.currentTarget.getBoundingClientRect(),
                  });
                }
              }}
              onClick={(e) => {
                if (hasSub) {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setOpenSub((prev) =>
                    prev?.idx === idx ? null : { idx, rect },
                  );
                  return;
                }
                onClose();
                entry.onSelect(e.currentTarget);
              }}
            >
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                {entry.icon && <Icon name={entry.icon} size={14} />}
                <span className="truncate">{entry.label}</span>
              </span>
              {(entry.shortcut || hasSub) && (
                <span className="context-menu-tail">
                  {entry.shortcut && (
                    <span className="context-menu-kbd">{entry.shortcut}</span>
                  )}
                  {hasSub && (
                    <Icon
                      name="chevronRight"
                      size={12}
                      className="context-menu-sub-arrow"
                    />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!closing &&
        openSub &&
        activeSubEntry?.renderSubmenu?.({
          anchorRect: openSub.rect,
          closeSubmenu: () => setOpenSub(null),
        })}
    </>,
    document.body,
  );
}

import { useEffect, useRef } from "react";
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
      onSelect: () => void;
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

  useEffect(() => {
    if (closing) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node | null)) return;
      onClose();
    };
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("keydown", onKeyCapture, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("keydown", onKeyCapture, true);
    };
  }, [closing, onClose]);

  const estHeight = items.length * 32 + 16;
  const flipUp = y + estHeight > window.innerHeight - 12 && y > estHeight + 16;
  const left = Math.max(10, Math.min(x, window.innerWidth - minWidth - 12));
  const top = flipUp
    ? Math.max(10, y - estHeight - 6)
    : Math.max(10, Math.min(y, window.innerHeight - estHeight - 12));

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      data-side={flipUp ? "top" : "bottom"}
      data-closing={closing ? "true" : "false"}
      className="context-menu"
      style={{ left, top, minWidth }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((entry, idx) => {
        if (entry.type === "divider") {
          return <div key={`div-${idx}`} className="context-menu-divider" />;
        }
        return (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            className={`context-menu-item${entry.danger ? " danger" : ""}`}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
          >
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              {entry.icon && <Icon name={entry.icon} size={14} />}
              <span className="truncate">{entry.label}</span>
            </span>
            {entry.shortcut && (
              <span className="context-menu-kbd">{entry.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

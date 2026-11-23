import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useValuePresence } from "../../state/usePresence";
import { Icon } from "./Icon";
import {
  computePopoverGeometry,
  usePopoverDismiss,
  type PopoverGeometry,
} from "./popoverPosition";

export interface CustomSelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  hint?: string;
  icon?: ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  mono?: boolean;
  fullWidth?: boolean;
  minMenuWidth?: number;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  mono = false,
  fullWidth = false,
  minMenuWidth = 176,
  style,
  ariaLabel,
}: CustomSelectProps) {
  const [geo, setGeo] = useState<PopoverGeometry | null>(null);
  const { rendered: activeGeo, closing } = useValuePresence(geo, 100);
  const [focusIdx, setFocusIdx] = useState(0);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => String(o.value) === String(value)),
  );
  const current = options[selectedIndex] ?? options[0];
  const isOpen = geo !== null;
  const closeMenu = useCallback(() => setGeo(null), []);

  const openMenu = useCallback(() => {
    const el = btnRef.current;
    if (!el || disabled) return;
    const rowH = options.some((o) => o.sublabel) ? 42 : 36;
    const estH = Math.min(260, options.length * rowH + 12);
    setFocusIdx(selectedIndex);
    setGeo(computePopoverGeometry(el, estH, minMenuWidth));
  }, [disabled, minMenuWidth, options, selectedIndex]);

  usePopoverDismiss(isOpen, btnRef, menuRef, closeMenu);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIdx(Math.max(0, options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const chosen = options[focusIdx];
      if (chosen) onChange(String(chosen.value));
      closeMenu();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        data-open={isOpen ? "true" : "false"}
        className={`custom-select-trigger${compact ? " compact" : ""}${mono ? " mono" : ""}${fullWidth ? " full" : ""}`}
        style={style}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className="row" style={{ gap: 7, minWidth: 0, flex: 1 }}>
          {current?.icon}
          <span className="truncate">{current?.label ?? ""}</span>
        </span>
        <Icon name="chevronDown" size={13} className="select-chevron" />
      </button>

      {activeGeo &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            data-side={activeGeo.side}
            data-closing={closing ? "true" : "false"}
            className="custom-select-menu"
            style={{
              left: activeGeo.left,
              top: activeGeo.top,
              bottom: activeGeo.bottom,
              width: activeGeo.width,
            }}
          >
            {options.map((opt, idx) => {
              const selected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`custom-select-option${mono ? " mono" : ""}${selected ? " selected" : ""}${focusIdx === idx ? " focused" : ""}`}
                  onMouseEnter={() => setFocusIdx(idx)}
                  onClick={() => {
                    onChange(String(opt.value));
                    closeMenu();
                  }}
                >
                  <span className="row" style={{ gap: 8, minWidth: 0 }}>
                    {opt.icon}
                    <span style={{ minWidth: 0 }}>
                      <div className="select-opt-label truncate">
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div className="select-opt-sub truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </span>
                  </span>
                  <span className="row" style={{ gap: 6, flexShrink: 0 }}>
                    {opt.hint && (
                      <span className="select-opt-hint">{opt.hint}</span>
                    )}
                    {selected && <Icon name="check" size={13} />}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

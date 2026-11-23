import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useValuePresence } from "../../state/usePresence";
import { Icon } from "./Icon";
import { CustomSelectPopover } from "./CustomSelectPopover";
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
  searchLabel?: string;
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
  searchLabel,
}: CustomSelectProps) {
  const [geo, setGeo] = useState<PopoverGeometry | null>(null);
  const { rendered: activeGeo, closing } = useValuePresence(geo, 100);
  const [focusIdx, setFocusIdx] = useState(0);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const choices = query
    ? options.filter((o) => o.label.toLowerCase().includes(query))
    : options;

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
    const estH = Math.min(260, options.length * rowH + (searchLabel ? 52 : 12));
    setSearch("");
    setFocusIdx(selectedIndex);
    setGeo(computePopoverGeometry(el, estH, minMenuWidth));
  }, [disabled, minMenuWidth, options, searchLabel, selectedIndex]);

  usePopoverDismiss(isOpen, btnRef, menuRef, closeMenu);

  const choose = (choice?: CustomSelectOption) => {
    if (choice) onChange(String(choice.value));
    btnRef.current?.focus({ preventScroll: true });
    closeMenu();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (disabled || e.nativeEvent.isComposing) return;
    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    const count = Math.max(1, choices.length);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i - 1 + count) % count);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusIdx(count - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(choices[focusIdx]);
    } else if (e.key === "Tab") {
      if (searchLabel) btnRef.current?.focus({ preventScroll: true });
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

      {activeGeo && (
        <CustomSelectPopover
          ref={menuRef}
          geo={activeGeo}
          closing={closing}
          search={search}
          searchLabel={searchLabel}
          choices={choices}
          value={value}
          focusIndex={focusIdx}
          mono={mono}
          onFocusIndex={setFocusIdx}
          onChoose={choose}
          onSearch={(query) => {
            setSearch(query);
            setFocusIdx(0);
          }}
          onKeyDown={handleKeyDown}
        />
      )}
    </>
  );
}

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { LabelPickerCreateFooter } from "./LabelPickerCreateFooter";
import { resolveLabelPickerStyle } from "./labelPickerPosition";
import {
  computeLabelTriState,
  filterLabelsWithCreateOption,
  LABEL_NAME_MAX_LEN,
  LABEL_PRESET_SWATCHES,
} from "./labelPopoverLogic";
import { useLabelPopoverDismiss } from "./useLabelPopoverDismiss";

export interface LabelPickerPopoverProps {
  mailIds: string[];
  anchorEl?: HTMLElement | null;
  anchorRect?: { left: number; top: number; right: number; bottom: number };
  x?: number;
  y?: number;
  cascade?: boolean;
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
}

export function LabelPickerPopover(props: LabelPickerPopoverProps) {
  const { mailIds, anchorEl, cascade = false, onClose, panelRef } = props;
  const { mailStore, toastStore } = useApp();
  const { t, localizeText } = useI18n();
  const innerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [newColor, setNewColor] = useState<string>(LABEL_PRESET_SWATCHES[0]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [creating, setCreating] = useState(false);

  const { filtered, trimmedQuery, canCreateNew } = useMemo(
    () => filterLabelsWithCreateOption(mailStore.labels, query, localizeText),
    [mailStore.labels, query, localizeText],
  );
  const totalNavCount = filtered.length + (canCreateNew ? 1 : 0);
  const safeIdx =
    totalNavCount === 0 ? -1 : Math.min(activeIdx, totalNavCount - 1);

  useLabelPopoverDismiss({
    panelRef: innerRef,
    inputRef,
    anchorEl,
    disabled: cascade,
    watchScroll: true,
    onClose,
  });

  const handleCreateAndApply = async () => {
    if (!trimmedQuery || creating) return;
    setCreating(true);
    await mailStore.createAndApplyLabel(trimmedQuery, newColor, mailIds);
    setCreating(false);
    setQuery("");
    setActiveIdx(0);
    toastStore.pushToast({
      tone: "success",
      title: t("labels.createdAndAppliedToast", { name: trimmedQuery }),
    });
  };

  const toggleFocused = () => {
    if (safeIdx >= 0 && safeIdx < filtered.length) {
      mailStore.toggleMailLabel(mailIds, filtered[safeIdx].id);
      return true;
    }
    return false;
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && totalNavCount > 0) {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : totalNavCount - 1;
      setActiveIdx((i) => (i + step) % totalNavCount);
    } else if (e.key === "ArrowLeft" && cascade && !query) {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!toggleFocused() && canCreateNew) void handleCreateAndApply();
    } else if (e.key === " " && !trimmedQuery && toggleFocused()) {
      e.preventDefault();
    }
  };

  const estHeight = Math.min(310, 130 + filtered.length * 34);
  const pos = resolveLabelPickerStyle({
    ...props,
    cascade,
    popWidth: 258,
    estHeight,
  });

  return createPortal(
    <div
      ref={(node) => {
        innerRef.current = node;
        if (panelRef) panelRef.current = node;
      }}
      role="dialog"
      aria-label={t("labels.pickerAria")}
      data-omnimail-popover="label-picker"
      data-side={pos.side}
      className="label-picker-popover"
      style={{
        left: pos.left,
        top: pos.top,
        bottom: pos.bottom,
        width: 258,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="lpp-search-wrap">
        <Icon name="search" size={13} />
        <input
          ref={inputRef}
          className="lpp-search-input"
          maxLength={LABEL_NAME_MAX_LEN}
          value={query}
          placeholder={t("labels.searchPlaceholder")}
          onChange={(e) => {
            setQuery(e.target.value.slice(0, LABEL_NAME_MAX_LEN));
            setActiveIdx(0);
          }}
          onKeyDown={handleInputKeyDown}
        />
        {canCreateNew && (
          <span className="lpp-enter-hint">
            {t("labels.enterToCreateHint")}
          </span>
        )}
      </div>

      {filtered.length > 0 ? (
        <FadeScroll className="lpp-list" label={t("labels.pickerAria")}>
          {filtered.map((lb, idx) => {
            const tri = computeLabelTriState(mailStore.mails, mailIds, lb.id);
            const dispName = localizeText(lb.name);
            return (
              <div
                key={lb.id}
                className={`lpp-option${safeIdx === idx ? " is-focused" : ""}${tri !== "unchecked" ? " is-selected" : ""}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => mailStore.toggleMailLabel(mailIds, lb.id)}
              >
                <Checkbox
                  size="sm"
                  checked={tri === "checked"}
                  indeterminate={tri === "indeterminate"}
                  ariaLabel={t("overlays.labelToggleAria", { name: dispName })}
                  onChange={() => mailStore.toggleMailLabel(mailIds, lb.id)}
                />
                <span className="label-dot" style={{ background: lb.color }} />
                <span className="lpp-option-name truncate">{dispName}</span>
              </div>
            );
          })}
        </FadeScroll>
      ) : (
        !canCreateNew && (
          <div className="lpp-empty-hint">{t("labels.emptyLabelsHint")}</div>
        )
      )}

      <LabelPickerCreateFooter
        canCreateNew={canCreateNew}
        trimmedQuery={trimmedQuery}
        newColor={newColor}
        creating={creating}
        isFocused={safeIdx === filtered.length}
        onFocusCreate={() => setActiveIdx(filtered.length)}
        onSelectColor={(hex) => {
          setNewColor(hex);
          inputRef.current?.focus({ preventScroll: true });
        }}
        onCreateAndApply={() => void handleCreateAndApply()}
        onFocusInput={() => inputRef.current?.focus({ preventScroll: true })}
      />
    </div>,
    document.body,
  );
}

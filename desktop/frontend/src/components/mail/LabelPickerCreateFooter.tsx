import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";
import { LABEL_PRESET_SWATCHES } from "./labelPopoverLogic";

interface LabelPickerCreateFooterProps {
  canCreateNew: boolean;
  trimmedQuery: string;
  newColor: string;
  creating: boolean;
  isFocused: boolean;
  onFocusCreate: () => void;
  onSelectColor: (hex: string) => void;
  onCreateAndApply: () => void;
  onFocusInput: () => void;
}

export function LabelPickerCreateFooter({
  canCreateNew,
  trimmedQuery,
  newColor,
  creating,
  isFocused,
  onFocusCreate,
  onSelectColor,
  onCreateAndApply,
  onFocusInput,
}: LabelPickerCreateFooterProps) {
  const { t } = useI18n();

  if (!canCreateNew) {
    return (
      <button
        type="button"
        className="lpp-quick-new-btn"
        onClick={onFocusInput}
      >
        <Icon name="plus" size={12} />
        <span>{t("labels.quickNewAndApplyBtn")}</span>
      </button>
    );
  }

  return (
    <div
      className={`lpp-create-bar${isFocused ? " is-focused" : ""}`}
      onMouseEnter={onFocusCreate}
    >
      <button
        type="button"
        className="lpp-create-main"
        disabled={creating}
        onClick={onCreateAndApply}
      >
        <span className="label-dot" style={{ background: newColor }} />
        <span className="truncate">
          {t("labels.createAndApplyBtn", { name: trimmedQuery })}
        </span>
      </button>
      <div
        className="lpp-mini-swatches"
        role="radiogroup"
        aria-label={t("labels.labelColorField")}
      >
        {LABEL_PRESET_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={newColor === hex}
            aria-label={t("overlays.labelColorSwatchAria", { hex })}
            className={`lpp-mini-swatch${newColor === hex ? " active" : ""}`}
            style={{ background: hex }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectColor(hex);
            }}
          />
        ))}
      </div>
    </div>
  );
}

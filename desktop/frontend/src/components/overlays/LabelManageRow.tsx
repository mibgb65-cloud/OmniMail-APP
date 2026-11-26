import { useI18n } from "../../i18n";
import type { MailLabel } from "../../types/mail";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import {
  LABEL_NAME_MAX_LEN,
  LABEL_PRESET_SWATCHES,
  type LabelTriState,
} from "../mail/labelPopoverLogic";

interface LabelManageRowProps {
  label: MailLabel;
  dispName: string;
  hasMailTarget: boolean;
  tri: LabelTriState;
  isEditing: boolean;
  editName: string;
  editColor: string;
  onEditNameChange: (val: string) => void;
  onEditColorChange: (hex: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onToggleLabel: () => void;
  onDelete: () => void;
}

export function LabelManageRow({
  label,
  dispName,
  hasMailTarget,
  tri,
  isEditing,
  editName,
  editColor,
  onEditNameChange,
  onEditColorChange,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onToggleLabel,
  onDelete,
}: LabelManageRowProps) {
  const { t } = useI18n();

  if (isEditing) {
    return (
      <div className="provider-card lmm-edit-row">
        <input
          className="input"
          style={{ flex: 1, height: 32 }}
          maxLength={LABEL_NAME_MAX_LEN}
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
        />
        <div
          className="swatch-row"
          role="radiogroup"
          aria-label={t("overlays.labelColorGroupAria")}
        >
          {LABEL_PRESET_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={editColor === hex}
              aria-label={t("overlays.labelColorSwatchAria", { hex })}
              className={`swatch-btn${editColor === hex ? " active" : ""}`}
              style={{ background: hex }}
              onClick={() => onEditColorChange(hex)}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!editName.trim()}
          onClick={onCommitEdit}
        >
          {t("common.save")}
        </button>
      </div>
    );
  }

  return (
    <div className="provider-card" style={{ padding: "8px 12px" }}>
      {hasMailTarget ? (
        <Checkbox
          checked={tri === "checked"}
          indeterminate={tri === "indeterminate"}
          onChange={onToggleLabel}
          style={{ flex: 1 }}
          ariaLabel={t("overlays.labelToggleAria", { name: dispName })}
        >
          <span className="row" style={{ gap: 8 }}>
            <span className="label-dot" style={{ background: label.color }} />
            <strong style={{ fontSize: 13 }}>{dispName}</strong>
          </span>
        </Checkbox>
      ) : (
        <div className="row" style={{ flex: 1, gap: 8 }}>
          <span className="label-dot" style={{ background: label.color }} />
          <strong style={{ fontSize: 13 }}>{dispName}</strong>
        </div>
      )}
      <div className="row" style={{ gap: 4 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label={t("labels.sidebarEditBtnAria", { name: dispName })}
          onClick={onStartEdit}
        >
          <Icon name="pencil" size={13} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--status-danger)" }}
          onClick={onDelete}
        >
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}

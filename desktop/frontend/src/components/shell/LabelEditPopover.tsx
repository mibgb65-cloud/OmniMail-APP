import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { MailLabel } from "../../types/mail";
import { Icon } from "../common/Icon";
import {
  computeSidePopoverCoords,
  LABEL_NAME_MAX_LEN,
  LABEL_PRESET_SWATCHES,
} from "../mail/labelPopoverLogic";
import { useLabelPopoverDismiss } from "../mail/useLabelPopoverDismiss";

export interface LabelEditPopoverProps {
  mode: "create" | "edit";
  label?: MailLabel;
  anchorRect: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
}

export function LabelEditPopover({
  mode,
  label,
  anchorRect,
  onClose,
}: LabelEditPopoverProps) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t, localizeText } = useI18n();
  const popRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const initialName = mode === "edit" && label ? localizeText(label.name) : "";
  const initialColor =
    mode === "edit" && label ? label.color : LABEL_PRESET_SWATCHES[0];

  const [name, setName] = useState(() =>
    initialName.slice(0, LABEL_NAME_MAX_LEN),
  );
  const [color, setColor] = useState<string>(initialColor);

  useLabelPopoverDismiss({
    panelRef: popRef,
    inputRef,
    selectOnFocus: mode === "edit",
    onClose,
  });

  const handleSave = () => {
    const clean = name.trim().slice(0, LABEL_NAME_MAX_LEN);
    if (!clean) return;
    if (mode === "edit" && label) {
      mailStore.renameLabel(label.id, clean, color);
      toastStore.pushToast({
        tone: "success",
        title: t("labels.updatedLabelToast", { name: clean }),
      });
    } else {
      mailStore.createLabel(clean, color);
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.createdLabel", { name: clean }),
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!label) return;
    onClose();
    workspace.setOverlay({
      type: "danger-confirm",
      kind: "delete-label",
      targetId: label.id,
      targetLabel: label.name,
    });
  };

  const popWidth = 244;
  const estHeight = mode === "edit" ? 218 : 210;
  const coords = computeSidePopoverCoords(
    anchorRect,
    popWidth,
    estHeight,
    { width: window.innerWidth, height: window.innerHeight },
    8,
  );
  const title =
    mode === "edit" ? t("labels.editLabelTitle") : t("labels.createLabelTitle");

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={title}
      data-omnimail-popover="label-edit"
      className="label-edit-popover"
      style={{ left: coords.left, top: coords.top, width: popWidth }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="lep-header">
        <strong className="lep-title">{title}</strong>
        <button
          type="button"
          className="icon-btn lep-close-btn"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <Icon name="x" size={13} />
        </button>
      </div>

      <div className="lep-field">
        <label className="lep-field-label">{t("labels.labelNameField")}</label>
        <input
          ref={inputRef}
          className="input lep-input"
          maxLength={LABEL_NAME_MAX_LEN}
          value={name}
          placeholder={t("labels.labelNamePlaceholder")}
          onChange={(e) => setName(e.target.value.slice(0, LABEL_NAME_MAX_LEN))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
        />
      </div>

      <div className="lep-field">
        <span className="lep-field-label">{t("labels.labelColorField")}</span>
        <div
          className="swatch-row lep-swatches"
          role="radiogroup"
          aria-label={t("labels.labelColorField")}
        >
          {LABEL_PRESET_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={color === hex}
              aria-label={t("overlays.labelColorSwatchAria", { hex })}
              className={`swatch-btn${color === hex ? " active" : ""}`}
              style={{ background: hex }}
              onClick={() => {
                setColor(hex);
                inputRef.current?.focus({ preventScroll: true });
              }}
            />
          ))}
        </div>
      </div>

      <div className="lep-divider" />

      <div className="lep-footer">
        {mode === "edit" && label ? (
          <button
            type="button"
            className="lep-delete-btn"
            onClick={handleDelete}
          >
            {t("labels.deleteLabelBtn")}
          </button>
        ) : (
          <span />
        )}
        <div className="lep-actions">
          {mode === "create" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!name.trim()}
            onClick={handleSave}
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

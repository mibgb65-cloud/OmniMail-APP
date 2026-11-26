import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { ModalShell } from "../common/ModalShell";
import {
  computeLabelTriState,
  LABEL_NAME_MAX_LEN,
  LABEL_PRESET_SWATCHES,
} from "../mail/labelPopoverLogic";
import { LabelManageRow } from "./LabelManageRow";

export function LabelManageModal({ mailIds }: { mailIds?: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t, localizeText } = useI18n();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(LABEL_PRESET_SWATCHES[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(LABEL_PRESET_SWATCHES[0]);
  const hasMailTarget = Boolean(mailIds && mailIds.length > 0);

  const handleCreate = async () => {
    const clean = newName.trim().slice(0, LABEL_NAME_MAX_LEN);
    if (!clean) return;
    if (mailIds && mailIds.length > 0) {
      await mailStore.createAndApplyLabel(clean, newColor, mailIds);
      toastStore.pushToast({
        tone: "success",
        title: t("labels.createdAndAppliedToast", { name: clean }),
      });
    } else {
      mailStore.createLabel(clean, newColor);
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.createdLabel", { name: clean }),
      });
    }
    setNewName("");
  };

  const commitEdit = (id: string) => {
    const clean = editName.trim().slice(0, LABEL_NAME_MAX_LEN);
    if (!clean) return;
    mailStore.renameLabel(id, clean, editColor);
    setEditId(null);
    toastStore.pushToast({
      tone: "success",
      title: t("labels.updatedLabelToast", { name: clean }),
    });
  };

  return (
    <ModalShell
      heading={t("overlays.labelHeading")}
      subtitle={
        mailIds && mailIds.length > 0
          ? t("overlays.labelSubtitleSelected", { count: mailIds.length })
          : t("overlays.labelSubtitleWorkspace")
      }
      maxWidth={480}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <span className="text-xs text-muted">
            {t("overlays.labelFooterHint")}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            {t("common.done")}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mailStore.labels.map((lb) => {
          const dispName = localizeText(lb.name);
          const tri =
            mailIds && mailIds.length > 0
              ? computeLabelTriState(mailStore.mails, mailIds, lb.id)
              : "unchecked";
          return (
            <LabelManageRow
              key={lb.id}
              label={lb}
              dispName={dispName}
              hasMailTarget={hasMailTarget}
              tri={tri}
              isEditing={editId === lb.id}
              editName={editName}
              editColor={editColor}
              onEditNameChange={setEditName}
              onEditColorChange={setEditColor}
              onStartEdit={() => {
                setEditId(lb.id);
                setEditName(dispName);
                setEditColor(lb.color);
              }}
              onCancelEdit={() => setEditId(null)}
              onCommitEdit={() => commitEdit(lb.id)}
              onToggleLabel={() =>
                mailIds && mailStore.toggleMailLabel(mailIds, lb.id)
              }
              onDelete={() =>
                workspace.setOverlay({
                  type: "danger-confirm",
                  kind: "delete-label",
                  targetId: lb.id,
                  targetLabel: lb.name,
                })
              }
            />
          );
        })}
      </div>

      <div className="settings-card">
        <div className="row-between">
          <span className="text-xs text-muted">
            {t("overlays.labelNewHeading")}
          </span>
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
                aria-checked={newColor === hex}
                aria-label={t("overlays.labelColorSwatchAria", { hex })}
                className={`swatch-btn${newColor === hex ? " active" : ""}`}
                style={{ background: hex }}
                onClick={() => setNewColor(hex)}
              />
            ))}
          </div>
        </div>
        <div className="row">
          <input
            className="input"
            style={{ flex: 1 }}
            maxLength={LABEL_NAME_MAX_LEN}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder={t("overlays.labelNewPlaceholder")}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!newName.trim()}
            onClick={() => void handleCreate()}
          >
            {t("common.add")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

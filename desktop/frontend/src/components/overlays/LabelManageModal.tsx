import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { ModalShell } from "../common/ModalShell";

const PRESET_SWATCHES = [
  "#2563EB",
  "#4F46E5",
  "#16A34A",
  "#D97706",
  "#DC2626",
  "#0891B2",
];

export function LabelManageModal({ mailIds }: { mailIds?: string[] }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t } = useI18n();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#2563EB");
  const targetMail =
    mailIds?.length === 1
      ? mailStore.mails.find((m) => m.id === mailIds[0])
      : null;

  const createLabel = () => {
    const clean = newName.trim();
    if (!clean) return;
    mailStore.createLabel(clean, newColor);
    setNewName("");
    toastStore.pushToast({
      tone: "success",
      title: t("toasts.createdLabel", { name: clean }),
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
      maxWidth={460}
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
          const checked = targetMail
            ? targetMail.labels.includes(lb.id)
            : false;
          return (
            <div
              key={lb.id}
              className="provider-card"
              style={{ padding: "9px 12px" }}
            >
              {mailIds && mailIds.length > 0 ? (
                <Checkbox
                  checked={checked}
                  onChange={() => mailStore.toggleMailLabel(mailIds, lb.id)}
                  style={{ flex: 1 }}
                  ariaLabel={t("overlays.labelToggleAria", { name: lb.name })}
                >
                  <span className="row" style={{ gap: 8 }}>
                    <span
                      className="label-dot"
                      style={{ background: lb.color }}
                    />
                    <strong style={{ fontSize: 13 }}>{lb.name}</strong>
                  </span>
                </Checkbox>
              ) : (
                <div className="row" style={{ flex: 1, gap: 8 }}>
                  <span
                    className="label-dot"
                    style={{ background: lb.color }}
                  />
                  <strong style={{ fontSize: 13 }}>{lb.name}</strong>
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--status-danger)" }}
                onClick={() =>
                  workspace.setOverlay({
                    type: "danger-confirm",
                    kind: "delete-label",
                    targetId: lb.id,
                    targetLabel: lb.name,
                  })
                }
              >
                {t("common.delete")}
              </button>
            </div>
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
            {PRESET_SWATCHES.map((hex) => (
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
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createLabel();
            }}
            placeholder={t("overlays.labelNewPlaceholder")}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={createLabel}
          >
            {t("common.add")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { MailLabel } from "../../types/mail";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { countLabelUsage } from "../mail/labelPopoverLogic";
import { LabelEditPopover } from "./LabelEditPopover";

type EditingLabelState =
  | { mode: "create"; rect: DOMRect }
  | { mode: "edit"; label: MailLabel; rect: DOMRect };

export function SidebarLabelSection({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, mailStore } = useApp();
  const { t, localizeText } = useI18n();
  const { labels, activeLabelId, mails } = mailStore;
  const [editing, setEditing] = useState<EditingLabelState | null>(null);

  const usageCounts = useMemo(() => countLabelUsage(mails), [mails]);

  return (
    <div className="nav-section">
      <div className="nav-section-head">
        <span>{t("sidebar.labels")}</span>
        <Tooltip label={t("labels.sidebarCreateTip")} placement="right">
          <button
            type="button"
            className="nav-section-action sidebar-label-add-btn"
            aria-label={t("labels.sidebarCreateTip")}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setEditing((prev) =>
                prev?.mode === "create" ? null : { mode: "create", rect },
              );
            }}
          >
            <Icon name="plus" size={13} />
          </button>
        </Tooltip>
      </div>

      {labels.map((lbl) => {
        const active = workspace.screen === "mail" && activeLabelId === lbl.id;
        const isEditingRow =
          editing?.mode === "edit" && editing.label.id === lbl.id;
        const dispName = localizeText(lbl.name);
        const count = usageCounts[lbl.id] ?? 0;

        return (
          <div
            key={lbl.id}
            className={`sidebar-label-row${active ? " active" : ""}${isEditingRow ? " is-editing" : ""}`}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditing({
                mode: "edit",
                label: lbl,
                rect: e.currentTarget.getBoundingClientRect(),
              });
            }}
          >
            <button
              type="button"
              className="sidebar-label-main-btn"
              aria-pressed={active}
              onClick={() => {
                workspace.setScreen("mail");
                mailStore.selectLabel(lbl.id);
                onNavigate?.();
              }}
            >
              <span className="label-dot" style={{ background: lbl.color }} />
              <span className="nav-item-label truncate">{dispName}</span>
            </button>

            <div className="sidebar-label-tail">
              {count > 0 && (
                <span className="sidebar-label-count">{count}</span>
              )}
              <button
                type="button"
                className="sidebar-label-edit-btn"
                aria-label={t("labels.sidebarEditBtnAria", { name: dispName })}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const row = e.currentTarget.closest(".sidebar-label-row");
                  if (!row) return;
                  const rect = row.getBoundingClientRect();
                  setEditing((prev) =>
                    prev?.mode === "edit" && prev.label.id === lbl.id
                      ? null
                      : { mode: "edit", label: lbl, rect },
                  );
                }}
              >
                <Icon name="more" size={13} />
              </button>
            </div>
          </div>
        );
      })}

      {editing && (
        <LabelEditPopover
          mode={editing.mode}
          label={editing.mode === "edit" ? editing.label : undefined}
          anchorRect={editing.rect}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

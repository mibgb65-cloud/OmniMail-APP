import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import type { ContactItem } from "../../types/workspace";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import { ContactMailHistoryCard } from "./ContactMailHistoryCard";

export function ContactDetailPanel({
  contact,
  isDrawer = false,
  closing = false,
  onClose,
}: {
  contact: ContactItem;
  isDrawer?: boolean;
  closing?: boolean;
  onClose: () => void;
}) {
  const { workspace, composeStore, toastStore } = useApp();
  const { t, localizeGroup, localizeText } = useI18n();
  const closeTip = t("contacts.closeDetailTip");

  const pane = (
    <aside
      className={`panel-card ai-pane ${isDrawer ? "ai-drawer" : "ai-pane-inline"}`}
      data-closing={!isDrawer && closing ? "true" : "false"}
      aria-label={t("contacts.detailAria")}
    >
      <div className="ai-header">
        <strong style={{ fontSize: 14 }}>{t("contacts.detailAria")}</strong>
        <Tooltip label={closeTip} shortcut="Esc">
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label={closeTip}
          >
            <Icon name="x" size={14} />
          </button>
        </Tooltip>
      </div>

      <FadeScroll
        className="ai-scroll"
        surface={isDrawer ? "--bg-ai-surface" : "--bg-card"}
        label={t("contacts.detailScrollLabel")}
      >
        <div className="row" style={{ gap: 12 }}>
          <div
            className={`avatar avatar-${contact.avatarTone}`}
            style={{ width: 46, height: 46, fontSize: 17 }}
          >
            {contact.avatarText}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <strong style={{ fontSize: 16, color: "var(--text-ink)" }}>
                {contact.name}
              </strong>
              {contact.vip && <span className="pill pill-warning">VIP</span>}
            </div>
            <div className="text-xs text-muted truncate">{contact.email}</div>
            {(contact.company || contact.title) && (
              <div className="text-xs text-muted">
                {[localizeText(contact.company), localizeText(contact.title)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={() => {
              workspace.setScreen("mail");
              composeStore.openNewCompose([
                `${contact.name} <${contact.email}>`,
              ]);
            }}
          >
            <Icon name="pen" size={13} /> {t("contacts.writeMailFull")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => workspace.toggleContactVip(contact.id)}
          >
            <Icon name="star" size={13} />{" "}
            {contact.vip
              ? t("contacts.unsetVipShort")
              : t("contacts.setVipShort")}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              workspace.setOverlay({
                type: "contact-edit",
                contactId: contact.id,
              })
            }
          >
            {t("common.edit")}
          </button>
        </div>

        <div className="settings-card">
          <div className="text-xs text-muted">
            {t("contacts.groupsAndSourceLabel")}
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className="pill pill-accent">
              {localizeText(contact.sourceTag)}
            </span>
            {contact.groups.map((g) => (
              <span key={g} className="pill pill-neutral">
                {localizeGroup(g)}
              </span>
            ))}
          </div>
          {contact.phone && (
            <div className="text-xs text-muted">
              {t("contacts.phonePrefix", { phone: contact.phone })}
            </div>
          )}
          {contact.note && (
            <div style={{ fontSize: 12, lineHeight: 1.55 }}>
              {t("contacts.notePrefix", { note: contact.note })}
            </div>
          )}
        </div>

        <ContactMailHistoryCard contact={contact} />

        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--status-danger)" }}
            onClick={() => {
              workspace.addBlacklist({
                target: contact.email,
                kind: "address",
                reason: t("contacts.detailBlacklistReason", {
                  name: contact.name,
                }),
                blockedCount: 0,
                addedAt: "今天",
              });
              toastStore.pushToast({
                tone: "warning",
                title: t("toasts.addedToBlacklist", { email: contact.email }),
              });
            }}
          >
            <Icon name="ban" size={14} /> {t("contacts.blockSenderBtn")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--status-danger)" }}
            onClick={() => {
              workspace.deleteContact(contact.id);
              onClose();
              toastStore.pushToast({
                tone: "info",
                title: t("toasts.deletedContact"),
              });
            }}
          >
            <Icon name="trash" size={14} /> {t("contacts.deleteContactBtn")}
          </button>
        </div>
      </FadeScroll>
    </aside>
  );

  if (!isDrawer) return pane;
  const layer = (
    <div
      className="workspace-drawer-layer"
      data-closing={closing ? "true" : "false"}
      role="dialog"
      aria-label={t("contacts.detailDrawerAria")}
    >
      <div className="drawer-scrim" onClick={onClose} />
      {pane}
    </div>
  );
  const stageEl = document.getElementById("workspace-stage");
  return stageEl ? createPortal(layer, stageEl) : layer;
}

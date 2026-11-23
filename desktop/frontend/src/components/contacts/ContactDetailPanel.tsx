import { createPortal } from "react-dom";
import { useApp } from "../../state/AppContext";
import type { ContactItem } from "../../types/workspace";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
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

  const pane = (
    <aside
      className={`panel-card ai-pane ${isDrawer ? "ai-drawer" : "ai-pane-inline"}`}
      data-closing={!isDrawer && closing ? "true" : "false"}
      aria-label="联系人详情"
    >
      <div className="ai-header">
        <strong style={{ fontSize: 14 }}>联系人详情</strong>
        <Tooltip label="收起详情" shortcut="Esc">
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="收起详情"
          >
            <Icon name="x" size={14} />
          </button>
        </Tooltip>
      </div>

      <div className="ai-scroll">
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
                {[contact.company, contact.title].filter(Boolean).join(" · ")}
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
            <Icon name="pen" size={13} /> 写邮件
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => workspace.toggleContactVip(contact.id)}
          >
            <Icon name="star" size={13} />{" "}
            {contact.vip ? "取消 VIP" : "设为 VIP"}
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
            编辑
          </button>
        </div>

        <div className="settings-card">
          <div className="text-xs text-muted">所属分组与来源</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className="pill pill-accent">{contact.sourceTag}</span>
            {contact.groups.map((g) => (
              <span key={g} className="pill pill-neutral">
                {g}
              </span>
            ))}
          </div>
          {contact.phone && (
            <div className="text-xs text-muted">电话：{contact.phone}</div>
          )}
          {contact.note && (
            <div style={{ fontSize: 12, lineHeight: 1.55 }}>
              备注：{contact.note}
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
                reason: `用户从联系人详情加入黑名单（${contact.name}）`,
                blockedCount: 0,
                addedAt: "今天",
              });
              toastStore.pushToast({
                tone: "warning",
                title: `已将 ${contact.email} 加入拦截黑名单`,
              });
            }}
          >
            <Icon name="ban" size={14} /> 屏蔽发件人
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--status-danger)" }}
            onClick={() => {
              workspace.deleteContact(contact.id);
              onClose();
              toastStore.pushToast({ tone: "info", title: "已删除联系人" });
            }}
          >
            <Icon name="trash" size={14} /> 删除联系人
          </button>
        </div>
      </div>
    </aside>
  );

  if (!isDrawer) return pane;
  const layer = (
    <div
      className="workspace-drawer-layer"
      data-closing={closing ? "true" : "false"}
      role="dialog"
      aria-label="联系人详情抽屉"
    >
      <div className="drawer-scrim" onClick={onClose} />
      {pane}
    </div>
  );
  const stageEl = document.getElementById("workspace-stage");
  return stageEl ? createPortal(layer, stageEl) : layer;
}

import { useApp } from "../../state/AppContext";
import type { ContactItem } from "../../types/workspace";
import { Icon } from "../common/Icon";

export function ContactDetailPanel({
  contact,
  isDrawer = false,
  onClose,
}: {
  contact: ContactItem;
  isDrawer?: boolean;
  onClose: () => void;
}) {
  const { workspace, mailStore, composeStore, toastStore } = useApp();
  const relatedMails = mailStore.mails
    .filter(
      (m) =>
        m.senderEmail.toLowerCase() === contact.email.toLowerCase() ||
        m.recipients.toLowerCase().includes(contact.email.toLowerCase()),
    )
    .slice(0, 5);

  const pane = (
    <aside
      className={`panel-card ${isDrawer ? "ai-drawer" : ""}`}
      style={{
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}
      aria-label="联系人详情"
    >
      <div className="ai-header">
        <strong style={{ fontSize: 14 }}>联系人详情</strong>
        <button
          type="button"
          className="btn-icon"
          onClick={onClose}
          title="收起详情"
        >
          <Icon name="x" size={14} />
        </button>
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
            <div className="text-xs text-muted">
              {contact.company} · {contact.title}
            </div>
          </div>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={() =>
              composeStore.openNewCompose([
                `${contact.name} <${contact.email}>`,
              ])
            }
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
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: "var(--text-body)",
              }}
            >
              备注：{contact.note}
            </div>
          )}
        </div>

        <div className="settings-card">
          <div className="row-between">
            <strong style={{ fontSize: 13 }}>往来邮件记录</strong>
            <span className="text-xs text-muted">
              共 {contact.mailCount} 封
            </span>
          </div>
          {relatedMails.length === 0 ? (
            <div className="text-xs text-muted">
              最近 90 天本地缓存中暂无匹配邮件。
            </div>
          ) : (
            relatedMails.map((m) => (
              <button
                key={m.id}
                type="button"
                className="ai-deadline-row"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => {
                  workspace.setScreen("mail");
                  mailStore.openMail(m.id);
                }}
              >
                <span className="truncate">{m.subject}</span>
                <span className="text-xs text-muted" style={{ flexShrink: 0 }}>
                  {m.timeText}
                </span>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--status-danger)", alignSelf: "flex-start" }}
          onClick={() => {
            workspace.addBlacklist({
              target: contact.email,
              kind: "address",
              reason: `用户从联系人详情加入黑名单（${contact.name}）`,
              blockedCount: 0,
              addedAt: "2026-11-20",
            });
            toastStore.pushToast({
              tone: "warning",
              title: `已将 ${contact.email} 加入拦截黑名单`,
            });
          }}
        >
          <Icon name="ban" size={14} /> 屏蔽此发件人
        </button>
      </div>
    </aside>
  );

  if (!isDrawer) return pane;

  return (
    <div
      className="workspace-drawer-layer"
      role="dialog"
      aria-label="联系人详情抽屉"
    >
      <div className="drawer-scrim" onClick={onClose} />
      {pane}
    </div>
  );
}

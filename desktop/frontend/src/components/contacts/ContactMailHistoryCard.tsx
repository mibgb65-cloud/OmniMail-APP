import { useEffect, useState } from "react";
import { mailApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { MailItem } from "../../types/mail";
import type { ContactItem } from "../../types/workspace";

export function ContactMailHistoryCard({ contact }: { contact: ContactItem }) {
  const { workspace, mailStore } = useApp();
  const [historyMails, setHistoryMails] = useState<MailItem[]>([]);

  useEffect(() => {
    if (!isWailsDesktop()) return;
    let active = true;
    void mailApi
      .listMessages({
        keyword: contact.email,
        folder: "",
        tab: "all",
        limit: 15,
      })
      .then((page) => {
        if (active) setHistoryMails(page.items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [contact.email]);

  const relatedMails = isWailsDesktop()
    ? historyMails
    : mailStore.mails
        .filter(
          (m) =>
            m.senderEmail.toLowerCase() === contact.email.toLowerCase() ||
            m.recipients.toLowerCase().includes(contact.email.toLowerCase()),
        )
        .slice(0, 8);

  return (
    <div className="settings-card">
      <div className="row-between">
        <strong style={{ fontSize: 13 }}>往来邮件记录</strong>
        <span className="text-xs text-muted">
          共 {Math.max(contact.mailCount, relatedMails.length)} 封
        </span>
      </div>
      {relatedMails.length === 0 ? (
        <div className="text-xs text-muted">本地数据库中暂无往来邮件。</div>
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
  );
}

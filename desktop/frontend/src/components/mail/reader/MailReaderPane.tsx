import { useState } from "react";
import { useApp } from "../../../state/AppContext";
import { Icon } from "../../common/Icon";
import { ProviderIcon } from "../../common/ProviderIcon";
import { MeetingInviteCard } from "./MeetingInviteCard";
import { QuickReplyBox } from "./QuickReplyBox";
import { ReaderAttachmentsSection } from "./ReaderAttachmentsSection";
import { ReaderSecurityBanners } from "./ReaderSecurityBanners";
import { ReaderThreadCard } from "./ReaderThreadCard";
import { ReaderToolbar } from "./ReaderToolbar";

export function MailReaderPane() {
  const { mailStore } = useApp();
  const { filteredMails, selectedMail, labels } = mailStore;
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  if (!selectedMail) {
    return (
      <section className="panel-card mail-reader-pane" aria-label="邮件阅读区">
        <div className="list-empty-state">
          <Icon name="mail" size={32} />
          <div style={{ fontWeight: 600, color: "var(--text-ink)" }}>
            未选择邮件
          </div>
          <div style={{ fontSize: 12 }}>
            在左侧列表点击任意邮件以查看正文、附件与会话记录。
          </div>
        </div>
      </section>
    );
  }

  const currentIndex = Math.max(
    0,
    filteredMails.findIndex((m) => m.id === selectedMail.id),
  );

  const navigate = (delta: -1 | 1) => {
    const next = filteredMails[currentIndex + delta];
    if (next) mailStore.openMail(next.id);
  };

  const mailLabels = labels.filter((l) => selectedMail.labels.includes(l.id));

  return (
    <section className="panel-card mail-reader-pane" aria-label="邮件正文阅读">
      <ReaderToolbar
        mail={selectedMail}
        currentIndex={currentIndex}
        totalCount={filteredMails.length}
        onNavigate={navigate}
      />

      <div className="reader-scroll selectable">
        <div className="reader-badges-row">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            <span
              className="pill pill-neutral"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-ink)",
              }}
            >
              <ProviderIcon provider={selectedMail.provider} size={16} />
              <span>{selectedMail.accountTag}</span>
            </span>
            {selectedMail.meetingInvite && (
              <span className="pill pill-blue">日程邀请 · .ics</span>
            )}
            {mailLabels.map((lbl) => (
              <span
                key={lbl.id}
                className="pill"
                style={{
                  background: `${lbl.color}18`,
                  color: lbl.color,
                  border: `1px solid ${lbl.color}33`,
                }}
              >
                {lbl.name}
              </span>
            ))}
            {selectedMail.statusBadge && (
              <span className="pill pill-warning">
                {selectedMail.statusBadge}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {selectedMail.meetingInvite
              ? "日历事件"
              : `${selectedMail.messages.length} 封会话`}
          </span>
        </div>

        <h2 className="reader-subject">{selectedMail.subject}</h2>

        <ReaderSecurityBanners mail={selectedMail} />

        {selectedMail.meetingInvite && (
          <MeetingInviteCard
            mailId={selectedMail.id}
            invite={selectedMail.meetingInvite}
          />
        )}

        {selectedMail.messages.map((msg, idx) => {
          const isLatest = idx === selectedMail.messages.length - 1;
          const isExpanded =
            isLatest || !msg.collapsed || Boolean(expandedIds[msg.id]);

          return (
            <ReaderThreadCard
              key={msg.id}
              mail={selectedMail}
              msg={msg}
              isLatest={isLatest}
              isExpanded={isExpanded}
              onExpand={() =>
                setExpandedIds((prev) => ({ ...prev, [msg.id]: true }))
              }
            />
          );
        })}

        <ReaderAttachmentsSection
          attachments={selectedMail.attachments}
          mailSubject={selectedMail.subject}
        />
      </div>

      <QuickReplyBox mail={selectedMail} />
    </section>
  );
}

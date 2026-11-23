import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../../state/AppContext";
import { Icon } from "../../common/Icon";
import { ProviderIcon } from "../../common/ProviderIcon";
import { FadeScroll } from "../../common/scroll-fade/FadeScroll";
import { useTranslation } from "../translation/TranslationContext";
import { TranslationBanner } from "../translation/TranslationBanner";
import { MeetingInviteCard } from "./MeetingInviteCard";
import { QuickReplyBox } from "./QuickReplyBox";
import { ReaderAttachmentsSection } from "./ReaderAttachmentsSection";
import { ReaderSecurityBanners } from "./ReaderSecurityBanners";
import { ReaderThreadCard } from "./ReaderThreadCard";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderZeroAccountGuide } from "./ReaderZeroAccountGuide";

export function MailReaderPane() {
  const { workspace, mailStore } = useApp();
  const t = useTranslation();
  const { filteredMails, selectedMail, labels } = mailStore;
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const content = t.result?.content;
  const translation = useMemo(
    () =>
      content && t.mode !== "original"
        ? { mode: t.mode, segments: content.segments, target: content.target }
        : undefined,
    [content, t.mode],
  );

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [selectedMail?.id]);

  if (!selectedMail) {
    return (
      <section className="panel-card mail-reader-pane" aria-label="邮件阅读区">
        {workspace.accounts.length === 0 ? (
          <ReaderZeroAccountGuide />
        ) : (
          <div className="list-empty-state">
            <Icon name="mail" size={32} />
            <div style={{ fontWeight: 600, color: "var(--text-ink)" }}>
              未选择邮件
            </div>
            <div style={{ fontSize: 12 }}>
              在左侧列表点击任意邮件以查看正文、附件与会话记录。
            </div>
          </div>
        )}
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
  const translatedSubject = translation && content?.subject;

  return (
    <section className="panel-card mail-reader-pane" aria-label="邮件正文阅读">
      <ReaderToolbar
        mail={selectedMail}
        currentIndex={currentIndex}
        totalCount={filteredMails.length}
        onNavigate={navigate}
      />
      <TranslationBanner />

      <FadeScroll
        className="reader-scroll selectable"
        label="邮件正文"
        viewportProps={{ ref: scrollRef }}
      >
        <div key={selectedMail.id} className="reader-motion-stage">
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

          <h2
            className="reader-subject"
            title={translatedSubject ? selectedMail.subject : undefined}
          >
            {t.mode === "translated" && translatedSubject
              ? translatedSubject
              : selectedMail.subject}
          </h2>
          {t.mode === "bilingual" && translatedSubject && (
            <p className="reader-translated-subject" lang={content?.target}>
              {translatedSubject}
            </p>
          )}

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
              isLatest ||
              !msg.collapsed ||
              Boolean(expandedIds[msg.id]) ||
              Boolean(t.result && msg.id === selectedMail.id);

            return (
              <ReaderThreadCard
                key={msg.id}
                mail={selectedMail}
                msg={msg}
                translation={
                  msg.id === selectedMail.id ? translation : undefined
                }
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
      </FadeScroll>

      <QuickReplyBox mail={selectedMail} />
    </section>
  );
}

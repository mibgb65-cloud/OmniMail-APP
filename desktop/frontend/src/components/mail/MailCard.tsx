import { useEffect, useRef, type MouseEvent } from "react";
import { useI18n } from "../../i18n";
import type { MailItem } from "../../types/mail";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";

interface MailCardProps {
  mail: MailItem;
  summarized: boolean;
  compact: boolean;
  selected: boolean;
  checked: boolean;
  selectionMode: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
}

export function MailCard({
  mail,
  summarized,
  compact,
  selected,
  checked,
  selectionMode,
  onSelect,
  onToggleCheck,
  onContextMenu,
}: MailCardProps) {
  const { t, formatTime, localizeText } = useI18n();
  const displaySubject = mail.subject.trim()
    ? localizeText(mail.subject)
    : t("common.noSubject");
  const rightMeta = mail.statusBadge
    ? {
        text: localizeText(mail.statusBadge),
        cls: mail.folder === "outbox" ? "pill-danger" : "pill-blue",
      }
    : !summarized && mail.attachments.length > 0
      ? {
          text:
            mail.attachments.length > 1
              ? t("mailList.filesPill", { count: mail.attachments.length })
              : mail.attachments[0].ext ||
                t("mailList.filesPill", { count: 1 }),
          cls: "pill-neutral",
        }
      : !summarized && mail.starred
        ? { text: t("mailList.starredPill"), cls: "pill-neutral" }
        : null;

  const showCheckbox = selectionMode || checked;
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected) {
      cardRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      className={`mail-card ${selected ? "selected" : ""} ${mail.unread ? "" : "read"}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="mail-card-top">
        <div className="mail-card-sender">
          {showCheckbox && (
            <Checkbox
              size="sm"
              checked={checked}
              ariaLabel={t("mailList.selectMailAria", {
                subject: displaySubject,
              })}
              onChange={onToggleCheck}
            />
          )}
          {mail.unread && (
            <span
              className="unread-dot"
              aria-label={t("mailList.unreadDotAria")}
            />
          )}
          <span className="truncate">{mail.senderName}</span>
        </div>
        <span className="mail-card-time">{formatTime(mail.timeText)}</span>
      </div>

      <div className="mail-card-subject">{displaySubject}</div>
      {!compact && (
        <div className="mail-card-snippet">{localizeText(mail.snippet)}</div>
      )}

      <div className="mail-card-bottom">
        <span className="source-tag truncate" data-provider={mail.provider}>
          {mail.accountTag}
        </span>
        <div className="mail-card-meta-right">
          {!compact && mail.attachments.length > 0 && (
            <Icon name="paperclip" size={12} />
          )}
          {rightMeta && (
            <span className={`pill mail-meta-pill ${rightMeta.cls}`}>
              {rightMeta.text}
            </span>
          )}
          {summarized && (
            <span className="mail-summary-badge">
              {t("mailList.aiSummaryBadge")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

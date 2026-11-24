import { useI18n } from "../../../i18n";
import { ProviderIcon } from "../../common/ProviderIcon";
import type { MailItem, MailLabel } from "../../../types/mail";

export function ReaderSubjectSection({
  mail,
  labels,
  translatedSubject,
  translationMode,
  targetLanguage,
}: {
  mail: MailItem;
  labels: MailLabel[];
  translatedSubject?: string;
  translationMode: string;
  targetLanguage?: string;
}) {
  const { t, localizeText } = useI18n();
  const displaySubject = mail.subject.trim()
    ? localizeText(mail.subject)
    : t("common.noSubject");

  return (
    <>
      <div className="reader-badges-row">
        <div className="reader-badges-chips">
          <span className="pill pill-neutral reader-account-pill">
            <ProviderIcon provider={mail.provider} size={16} />
            <span>{mail.accountTag}</span>
          </span>
          {mail.meetingInvite && (
            <span className="pill pill-blue">
              {t("reader.calendarInvitePill")}
            </span>
          )}
          {labels.map((lbl) => (
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
          {mail.statusBadge && (
            <span className="pill pill-warning">
              {localizeText(mail.statusBadge)}
            </span>
          )}
        </div>
        <span className="reader-thread-meta">
          {mail.meetingInvite
            ? t("reader.calendarEventMeta")
            : t("reader.threadCountMeta", { count: mail.messages.length })}
        </span>
      </div>

      <h2
        className="reader-subject"
        title={translatedSubject ? displaySubject : undefined}
      >
        {translationMode === "translated" && translatedSubject
          ? translatedSubject
          : displaySubject}
      </h2>
      {translationMode === "bilingual" && translatedSubject && (
        <p className="reader-translated-subject" lang={targetLanguage}>
          {translatedSubject}
        </p>
      )}
    </>
  );
}

import { useState } from "react";
import { useI18n } from "../../../i18n";
import { useApp } from "../../../state/AppContext";
import type { MailItem, MailLabel } from "../../../types/mail";
import { Icon } from "../../common/Icon";
import { ProviderIcon } from "../../common/ProviderIcon";
import { Tooltip } from "../../common/Tooltip";
import { LabelPickerPopover } from "../LabelPickerPopover";

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
  const { mailStore } = useApp();
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);

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
          {labels.map((lbl) => {
            const dispName = localizeText(lbl.name);
            return (
              <span
                key={lbl.id}
                className="pill reader-label-chip"
                style={{
                  background: `${lbl.color}18`,
                  color: lbl.color,
                  border: `1px solid ${lbl.color}38`,
                }}
              >
                <span
                  className="reader-label-chip-dot"
                  style={{ background: lbl.color }}
                  aria-hidden="true"
                />
                <span>{dispName}</span>
                <button
                  type="button"
                  className="reader-label-chip-remove"
                  aria-label={t("labels.removeSubjectLabelAria", {
                    name: dispName,
                  })}
                  onClick={(e) => {
                    e.stopPropagation();
                    mailStore.toggleMailLabel([mail.id], lbl.id);
                  }}
                >
                  <Icon name="x" size={11} />
                </button>
              </span>
            );
          })}
          <Tooltip label={t("labels.addSubjectLabelTip")} shortcut="L">
            <button
              type="button"
              aria-label={t("labels.addSubjectLabelTip")}
              aria-expanded={pickerAnchor !== null}
              className={`reader-label-add-chip${pickerAnchor ? " is-open" : ""}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const el = e.currentTarget;
                setPickerAnchor((prev) => (prev ? null : el));
              }}
            >
              <Icon name="plus" size={11} />
            </button>
          </Tooltip>
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

      {pickerAnchor && (
        <LabelPickerPopover
          mailIds={[mail.id]}
          anchorEl={pickerAnchor}
          onClose={() => setPickerAnchor(null)}
        />
      )}

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

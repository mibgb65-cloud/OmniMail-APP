import { useI18n } from "../../../i18n";
import { mailApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import { isWailsDesktop } from "../../../state/storageHelpers";
import type { MeetingInvite } from "../../../types/mail";
import { Icon } from "../../common/Icon";

export function MeetingInviteCard({
  mailId,
  invite,
}: {
  mailId: string;
  invite: MeetingInvite;
}) {
  const { t } = useI18n();
  const { mailStore, toastStore } = useApp();

  const setRsvp = (next: MeetingInvite["rsvp"], label: string) => {
    const statusBadge = t("reader.icsBadgePrefix", { label });
    mailStore.updateMail(mailId, {
      meetingInvite: { ...invite, rsvp: next },
      statusBadge,
    });
    if (!isWailsDesktop()) {
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.meetingUpdatedPreview", { label }),
      });
      return;
    }
    void mailApi
      .respondMeetingInvite(mailId, next)
      .then((updated) => {
        mailStore.updateMail(mailId, { meetingInvite: updated, statusBadge });
        toastStore.pushToast({
          tone: "success",
          title: t("toasts.meetingRsvpSynced", { label }),
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("toasts.meetingRsvpFailed"),
          detail: parseBackendError(err).message,
        }),
      );
  };

  return (
    <div className="ics-card">
      <div className="ics-header">
        <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
          <div className="ics-cal-box">
            <div className="ics-cal-month">{invite.monthLabel}</div>
            <div className="ics-cal-day">{invite.dayNumber}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-ink)",
              }}
            >
              {invite.title}
            </div>
            <div className="row text-xs text-muted" style={{ gap: 6 }}>
              <Icon name="clock" size={13} /> {invite.dateTimeText}
            </div>
            <div className="row text-xs text-muted" style={{ gap: 6 }}>
              <Icon name="video" size={13} /> {invite.locationText}
            </div>
          </div>
        </div>
        <span
          className={`pill ${invite.conflictStatus === "free" ? "pill-success" : "pill-warning"}`}
          title={invite.conflictHint}
        >
          ●{" "}
          {invite.conflictStatus === "free"
            ? t("reader.icsNoConflict")
            : invite.conflictHint || t("reader.icsConflictFallback")}
        </span>
      </div>

      <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="text-xs text-muted">
          {t("reader.icsAttendeesCount", { count: invite.attendees.length })}
        </span>
        <span
          className="text-xs text-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {t("reader.icsAttachmentLabel", { name: invite.icsFileName })}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {invite.attendees.map((a) => (
          <span
            key={a.name}
            className="pill pill-neutral"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            <strong>{a.name}</strong> · {a.role}
          </span>
        ))}
      </div>

      <div
        className="row-between"
        style={{
          gap: 8,
          flexWrap: "wrap",
          paddingTop: 6,
          borderTop: "1px solid var(--border-default)",
        }}
      >
        <div className="row" style={{ gap: 6 }}>
          <span className="text-xs text-muted">{t("reader.icsYourReply")}</span>
          <button
            type="button"
            className={`btn btn-sm ${invite.rsvp === "accepted" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setRsvp("accepted", t("reader.icsAcceptedLabel"))}
          >
            <Icon name="check" size={13} /> {t("reader.icsAccept")}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${invite.rsvp === "tentative" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setRsvp("tentative", t("reader.icsTentativeLabel"))}
          >
            <Icon name="clock" size={13} /> {t("reader.icsTentative")}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${invite.rsvp === "declined" ? "btn-danger" : "btn-danger-soft"}`}
            onClick={() => setRsvp("declined", t("reader.icsDeclinedLabel"))}
          >
            <Icon name="x" size={13} /> {t("reader.icsDecline")}
          </button>
        </div>

        <div className="row" style={{ gap: 6 }}>
          {invite.meetingLink && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(invite.meetingLink)
                  .catch(() => undefined);
                toastStore.pushToast({
                  tone: "success",
                  title: t("toasts.copiedMeetingLink"),
                });
              }}
            >
              <Icon name="copy" size={13} /> {t("reader.icsCopyLink")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              void mailApi
                .exportMeetingICS(mailId)
                .then((savedPath) => {
                  if (savedPath) {
                    toastStore.pushToast({
                      tone: "info",
                      title: t("toasts.exportedIcsTitle"),
                      detail: savedPath,
                    });
                  }
                })
                .catch((err) =>
                  toastStore.pushToast({
                    tone: "danger",
                    title: t("toasts.exportIcsFailed"),
                    detail: parseBackendError(err).message,
                  }),
                );
            }}
          >
            <Icon name="download" size={13} /> {t("reader.icsExportBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

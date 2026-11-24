import type { CSSProperties } from "react";
import { useI18n } from "../../i18n";

const SKELETON_ROWS = [
  { sender: 106, subject: "78%", snippet: "92%", badge: 40, opacity: 1 },
  { sender: 84, subject: "86%", snippet: "84%", badge: 34, opacity: 1 },
  { sender: 118, subject: "72%", snippet: "94%", badge: 44, opacity: 1 },
  { sender: 92, subject: "82%", snippet: "86%", badge: 36, opacity: 0.92 },
  { sender: 76, subject: "68%", snippet: "82%", badge: 42, opacity: 0.78 },
  { sender: 110, subject: "76%", snippet: "90%", badge: 32, opacity: 0.62 },
] as const;

export function MailListSkeleton({ compact }: { compact: boolean }) {
  const { t } = useI18n();

  return (
    <div
      className="mail-list-skeleton-wrap"
      role="status"
      aria-live="polite"
      aria-label={t("mailList.loadingListAria")}
    >
      {!compact && (
        <div className="list-group-head" aria-hidden="true">
          <span
            className="omni-shimmer-bar"
            style={{ width: 92, height: 11 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: 54, height: 11 }}
          />
        </div>
      )}
      {SKELETON_ROWS.map((row, idx) => (
        <div
          key={idx}
          className="mail-card mail-list-skel-card"
          style={{ opacity: row.opacity } as CSSProperties}
          aria-hidden="true"
        >
          <div className="mail-card-top">
            <div className="mail-card-sender">
              <span className="mail-skel-dot omni-shimmer-bar" />
              <span
                className="omni-shimmer-bar"
                style={{ width: row.sender, height: 13 }}
              />
            </div>
            <span
              className="omni-shimmer-bar"
              style={{ width: 36, height: 11 }}
            />
          </div>
          <div className="mail-skel-line-row">
            <span
              className="omni-shimmer-bar"
              style={{ width: row.subject, height: 13 }}
            />
          </div>
          {!compact && (
            <div className="mail-skel-line-row">
              <span
                className="omni-shimmer-bar"
                style={{ width: row.snippet, height: 12 }}
              />
            </div>
          )}
          <div className="mail-card-bottom">
            <span className="mail-skel-pill omni-shimmer-bar" />
            <span
              className="mail-skel-badge omni-shimmer-bar"
              style={{ width: row.badge }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

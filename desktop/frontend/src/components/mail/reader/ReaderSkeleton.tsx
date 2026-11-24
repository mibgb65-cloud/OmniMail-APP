import { useI18n } from "../../../i18n";
import { resolveReaderViewPhase } from "../../../state/mailListLoadingPolicy";
import { Icon } from "../../common/Icon";
import { ReaderZeroAccountGuide } from "./ReaderZeroAccountGuide";

const BODY_LINE_WIDTHS = ["96%", "91%", "84%", "62%"] as const;

export function ReaderSkeleton() {
  const { t } = useI18n();

  return (
    <div
      className="reader-skeleton-wrap"
      role="status"
      aria-live="polite"
      aria-label={t("mailList.readerLoadingAria")}
    >
      <div className="reader-skeleton-toolbar" aria-hidden="true">
        <div className="row" style={{ gap: 8 }}>
          <span
            className="omni-shimmer-bar"
            style={{ width: 64, height: 28, borderRadius: 8 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: 64, height: 28, borderRadius: 8 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: 58, height: 28, borderRadius: 8 }}
          />
        </div>
        <span
          className="omni-shimmer-bar"
          style={{ width: 78, height: 28, borderRadius: 8 }}
        />
      </div>

      <div className="reader-skeleton-content" aria-hidden="true">
        <div className="reader-skeleton-subject">
          <span
            className="omni-shimmer-bar"
            style={{ width: "62%", height: 20, borderRadius: 6 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: 68, height: 18, borderRadius: 999 }}
          />
        </div>

        <div className="reader-skeleton-card">
          <div className="reader-skeleton-sender">
            <span className="reader-skeleton-avatar omni-shimmer-bar" />
            <div className="reader-skeleton-sender-meta">
              <span
                className="omni-shimmer-bar"
                style={{ width: 148, height: 13 }}
              />
              <span
                className="omni-shimmer-bar"
                style={{ width: 210, height: 11 }}
              />
            </div>
            <span
              className="omni-shimmer-bar"
              style={{ width: 58, height: 11 }}
            />
          </div>

          <div className="reader-skeleton-lines">
            {BODY_LINE_WIDTHS.map((width, idx) => (
              <span
                key={idx}
                className="omni-shimmer-bar"
                style={{ width, height: 13 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReaderEmptyOrSkeleton({
  accountCount,
  isInitialLoading,
}: {
  accountCount: number;
  isInitialLoading: boolean;
}) {
  const { t } = useI18n();
  const phase = resolveReaderViewPhase({
    accountCount,
    isInitialLoading,
    hasSelectedMail: false,
  });

  return (
    <section
      className="panel-card mail-reader-pane"
      aria-label={t("reader.ariaPane")}
    >
      {phase === "no-accounts" ? (
        <ReaderZeroAccountGuide />
      ) : phase === "loading" ? (
        <ReaderSkeleton />
      ) : (
        <div className="list-empty-state">
          <Icon name="mail" size={32} />
          <div style={{ fontWeight: 600, color: "var(--text-ink)" }}>
            {t("reader.noSelectionTitle")}
          </div>
          <div style={{ fontSize: 12 }}>{t("reader.noSelectionDesc")}</div>
        </div>
      )}
    </section>
  );
}

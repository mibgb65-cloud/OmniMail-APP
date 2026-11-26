import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import {
  shouldShowDailyQuota,
  type WorkBuddyAccount,
  type WorkBuddyAttachmentMeta,
  type WorkBuddyDailyQuota,
  type WorkBuddyDirection,
  type WorkBuddyMessageDetail,
} from "../../types/workbuddy";
import {
  buildAgentReplySubject,
  parseMailAddressDisplay,
} from "../../utils/agentMailFormat";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";
import {
  WorkBuddyReaderFooter,
  WorkBuddyReaderToolbar,
} from "./WorkBuddyReaderChrome";
import { WorkBuddyThreadCard } from "./WorkBuddyThreadCard";

export interface WorkBuddyReaderPaneProps {
  account?: WorkBuddyAccount;
  dir: WorkBuddyDirection;
  dailyQuota: WorkBuddyDailyQuota;
  lastSyncedAt: number;
  detail: WorkBuddyMessageDetail | null;
  loading: boolean;
  savingAttachmentId: string;
  currentIndex: number;
  totalCount: number;
  onNavigate: (delta: -1 | 1) => void;
  onMarkRead: () => void;
  onRefreshBody: () => void;
  onSaveAttachment: (att: WorkBuddyAttachmentMeta) => void;
  onRequestDelete: (messageId: string, subject: string) => void;
}

export function WorkBuddyReaderPane(props: WorkBuddyReaderPaneProps) {
  const {
    account,
    dir,
    dailyQuota,
    lastSyncedAt,
    detail,
    loading,
    savingAttachmentId,
    currentIndex,
    totalCount,
    onNavigate,
    onMarkRead,
    onRefreshBody,
    onSaveAttachment,
    onRequestDelete,
  } = props;
  const { workspace, composeStore, toastStore } = useApp();
  const { t } = useI18n();

  const copyText = (value: string, toastTitle: string) => {
    if (!value) return;
    void navigator.clipboard?.writeText(value).catch(() => undefined);
    toastStore.pushToast({ tone: "success", title: toastTitle });
  };

  const mailboxEmail = account?.email ?? "";
  const copyMailbox = () =>
    copyText(
      mailboxEmail,
      t("workbuddy.copiedMailboxToast", { email: mailboxEmail }),
    );

  if (loading && !detail) {
    return (
      <section className="panel-card mail-reader-pane wb-reader-pane">
        <div className="wb-reader-skeleton" aria-busy="true">
          <span
            className="omni-shimmer-bar"
            style={{ width: "56%", height: 20 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "38%", height: 13 }}
          />
          <span
            className="omni-shimmer-bar"
            style={{ width: "92%", height: 120 }}
          />
        </div>
        <WorkBuddyReaderFooter
          lastSyncedAt={lastSyncedAt}
          canCopyMailbox={Boolean(mailboxEmail)}
          canReply={false}
          onCopyMailbox={copyMailbox}
          onReplyViaRegular={() => undefined}
        />
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="panel-card mail-reader-pane wb-reader-pane">
        <div className="wb-empty-box wb-reader-empty">
          <span className="wb-empty-icon" aria-hidden="true">
            <Icon name="mail" size={20} />
          </span>
          <strong className="wb-empty-title">
            {t("workbuddy.selectMessageTitle")}
          </strong>
          <p className="wb-empty-desc">{t("workbuddy.selectMessageDesc")}</p>
        </div>
        <WorkBuddyReaderFooter
          lastSyncedAt={lastSyncedAt}
          canCopyMailbox={Boolean(mailboxEmail)}
          canReply={false}
          onCopyMailbox={copyMailbox}
          onReplyViaRegular={() => undefined}
        />
      </section>
    );
  }

  const subjectText = detail.subject || t("workbuddy.noSubject");
  const senderParsed = parseMailAddressDisplay(detail.from);
  const senderEmail = senderParsed.email || detail.from || "";
  const showQuota = shouldShowDailyQuota(dailyQuota);
  const replyTarget =
    dir === "sent"
      ? parseMailAddressDisplay(detail.to[0] ?? "").email || detail.to[0] || ""
      : senderEmail;

  return (
    <section className="panel-card mail-reader-pane wb-reader-pane">
      <WorkBuddyReaderToolbar
        isRead={detail.isRead}
        loading={loading}
        firstAttachment={detail.attachments[0]}
        savingAttachmentId={savingAttachmentId}
        currentIndex={currentIndex}
        totalCount={totalCount}
        onMarkRead={onMarkRead}
        onCopySender={() =>
          copyText(
            senderEmail,
            t("workbuddy.copiedSenderToast", { email: senderEmail }),
          )
        }
        onRefreshBody={onRefreshBody}
        onSaveAttachment={onSaveAttachment}
        onRequestDelete={() => onRequestDelete(detail.messageId, subjectText)}
        onNavigate={onNavigate}
      />

      <div className="reader-body">
        <FadeScroll
          key={detail.messageId}
          className="reader-scroll selectable"
          label={subjectText}
        >
          <div className="reader-badges-row">
            <div className="reader-badges-chips">
              <span className="pill pill-neutral reader-account-pill">
                <ProviderIcon provider="workbuddy" size={16} />
                <span>
                  {mailboxEmail ? `WorkBuddy · ${mailboxEmail}` : "WorkBuddy"}
                </span>
              </span>
              <span className="pill wb-dir-pill">
                {t(dir === "sent" ? "workbuddy.sentTab" : "workbuddy.inboxTab")}
              </span>
              {showQuota && (
                <span className="pill pill-neutral">
                  {t("workbuddy.dailyQuotaBadge", {
                    remaining: dailyQuota.remaining,
                    limit: dailyQuota.limit,
                  })}
                </span>
              )}
            </div>
            <span className="reader-thread-meta">
              {t("workbuddy.singleThreadMeta")}
            </span>
          </div>

          <h2 className="reader-subject">{subjectText}</h2>

          <WorkBuddyThreadCard
            detail={detail}
            savingAttachmentId={savingAttachmentId}
            onSaveAttachment={onSaveAttachment}
          />
        </FadeScroll>
      </div>

      <WorkBuddyReaderFooter
        lastSyncedAt={lastSyncedAt}
        canCopyMailbox={Boolean(mailboxEmail)}
        canReply={Boolean(replyTarget) && workspace.accounts.length > 0}
        onCopyMailbox={copyMailbox}
        onReplyViaRegular={() =>
          composeStore.openNewCompose(
            replyTarget ? [replyTarget] : [],
            buildAgentReplySubject(subjectText),
          )
        }
      />
    </section>
  );
}

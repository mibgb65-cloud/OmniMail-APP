import { useEffect, useState } from "react";
import type { ContactMailSummary } from "../../../bindings/omnimail/internal/contacts/models";
import { useI18n } from "../../i18n";
import { contactApi, mailApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import type { ContactItem } from "../../types/workspace";
import { FadeScroll } from "../common/scroll-fade/FadeScroll";

interface History {
  key: string;
  items: ContactMailSummary[];
  next: string;
  error?: boolean;
}

export function ContactMailHistoryCard({ contact }: { contact: ContactItem }) {
  const { workspace, mailStore, toastStore } = useApp();
  const { t, formatTime, localizeText } = useI18n();
  const { activeProfileId: profileId } = workspace;
  const key = JSON.stringify([
    profileId,
    contact.id,
    contact.email,
    contact.alternateEmails ?? [],
    contact.mailCount,
  ]);
  const [history, setHistory] = useState<History>();
  const [fetching, setFetching] = useState(false);
  const visible = history?.key === key ? history : undefined;
  const contactId = contact.id;

  useEffect(() => {
    if (!isWailsDesktop()) return;
    let active = true;
    void contactApi.mailHistory(profileId, contactId, "").then(
      (page) => {
        if (active)
          setHistory({ key, items: page.items ?? [], next: page.nextCursor });
      },
      () => {
        if (active) setHistory({ key, items: [], next: "", error: true });
      },
    );
    return () => {
      active = false;
    };
  }, [key, profileId, contactId]);

  const loadMore = async () => {
    if (!visible || fetching) return;
    setFetching(true);
    try {
      const page = await contactApi.mailHistory(
        profileId,
        contactId,
        visible.next,
      );
      setHistory((prev) =>
        prev?.key === key && prev.next === visible.next
          ? {
              key,
              items: [...prev.items, ...(page.items ?? [])],
              next: page.nextCursor,
            }
          : prev,
      );
    } catch {
      setHistory((prev) =>
        prev?.key === key ? { ...prev, error: true } : prev,
      );
    } finally {
      setFetching(false);
    }
  };

  const related = isWailsDesktop()
    ? (visible?.items ?? [])
    : mailStore.mails
        .filter(
          (m) =>
            m.senderEmail.toLowerCase() === contact.email.toLowerCase() ||
            m.recipients.toLowerCase().includes(contact.email.toLowerCase()),
        )
        .slice(0, 8);

  const openHistoryMail = async (id: string) => {
    try {
      if (!mailStore.mails.some((m) => m.id === id)) {
        const detail = await mailApi.getThreadDetail(id);
        if (!detail) throw new Error();
        mailStore.addMail(detail);
      } else {
        mailStore.openMail(id);
      }
      workspace.setScreen("mail");
    } catch {
      toastStore.pushToast({
        tone: "warning",
        title: t("toasts.openHistoryMailFailed"),
      });
    }
  };

  return (
    <>
      {Boolean(contact.alternateEmails?.length) && (
        <div className="settings-card">
          <strong>
            {t("contacts.altEmailsHeading", {
              count: contact.alternateEmails?.length ?? 0,
            })}
          </strong>
          <FadeScroll
            className="contact-alternate-addresses"
            label={t("contacts.altEmailsScrollLabel")}
          >
            {contact.alternateEmails?.map((email) => (
              <div key={email} className="truncate" title={email}>
                {email}
              </div>
            ))}
          </FadeScroll>
        </div>
      )}
      <div className="settings-card">
        <div className="row-between">
          <strong style={{ fontSize: 13 }}>
            {t("contacts.historyHeading")}
          </strong>
          <span className="text-xs text-muted">
            {t("contacts.historyShownCount", { count: related.length })}
          </span>
        </div>
        {related.map((m) => (
          <button
            key={m.id}
            type="button"
            className="ai-deadline-row"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => void openHistoryMail(m.id)}
          >
            <span className="truncate">
              {localizeText(m.subject) || t("common.noSubject")}
            </span>
            <span className="text-xs text-muted" style={{ flexShrink: 0 }}>
              {formatTime(m.timeText)}
            </span>
          </button>
        ))}
        {visible?.error ? (
          <span className="text-xs text-muted">
            {t("contacts.historyLoadError")}
          </span>
        ) : (
          !related.length && (
            <span className="text-xs text-muted">
              {isWailsDesktop() && !visible
                ? t("contacts.historyLoading")
                : t("contacts.historyEmpty")}
            </span>
          )
        )}
        {visible?.next && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={fetching}
            onClick={() => void loadMore()}
          >
            {fetching
              ? t("contacts.historyFetchingMore")
              : t("contacts.historyLoadMore")}
          </button>
        )}
      </div>
    </>
  );
}

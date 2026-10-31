import { useTranslation } from '../lib/i18n/useTranslation';
import * as api from '../lib/bridge/mail';
import type { MailController } from './useMail';
import { MailList } from './MailList';
import { MailReaderTransition } from './MailReaderTransition';
import styles from './MailContent.module.css';

export function MailContent({ mail }: { mail: MailController }) {
  const { t, locale } = useTranslation('mail');
  const formatTime = (time: number) => {
    const date = new Date(time);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
      : '—';
  };
  return (
    <>
      <MailList mail={mail} formatTime={formatTime} />
      <section
        data-mail-reader
        className={styles.reader}
        aria-label={t('selectMessage')}
        aria-busy={mail.loading || (!!mail.selected && mail.detail?.id !== mail.selected)}
      >
        {mail.autoReadError != null && (
          <p role="alert" className={styles.error}>
            {t('autoReadFailed')} {t(api.errorKey(mail.autoReadError))}
          </p>
        )}
        <MailReaderTransition
          key={mail.listKey}
          selected={mail.selected}
          detail={mail.detail}
          error={mail.bodyError}
          onRetry={mail.retryBody}
          busy={mail.loading}
          onRefresh={mail.refreshBody}
          onViewed={mail.markViewed}
          starFor={(message) => {
            const starred = mail.getStarred(message);
            const summary = {
              id: message.id,
              accountId: message.accountId,
              mailbox: message.mailbox,
              subject: message.subject,
              from: message.from,
              to: message.to,
              receivedAt: message.receivedAt,
              read: message.read,
              starred,
              cached: message.cached,
            };
            return {
              starred,
              pending: mail.isStarPending(message.id),
              toggle: () => void mail.toggleStarred(summary),
            };
          }}
        />
      </section>
    </>
  );
}

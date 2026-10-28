import { useState } from 'react';
import { useTranslation } from '../lib/i18n/useTranslation';
import * as api from '../lib/bridge/mail';
import type { MailController } from './useMail';
import styles from './MailContent.module.css';

export function MailContent({ mail }: { mail: MailController }) {
  const { t, locale } = useTranslation('mail');
  const [saving, setSaving] = useState('');
  const [saveError, setSaveError] = useState<unknown>();
  const formatTime = (time: number) => {
    const date = new Date(time);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
      : '—';
  };
  const save = async (id: string) => {
    setSaving(id);
    setSaveError(undefined);
    try {
      await api.saveAttachment(id);
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving('');
    }
  };
  const items = mail.messages.filter((message) =>
    `${message.subject} ${message.from}`
      .toLocaleLowerCase()
      .includes(mail.filter.toLocaleLowerCase()),
  );
  return (
    <>
      <section className={styles.list} aria-label={t('selectMessage')}>
        {mail.error != null && (
          <p role="alert" className={styles.error}>
            {t(api.errorKey(mail.error))}
          </p>
        )}
        {items.length === 0 && <p className={styles.empty}>{t('noMessages')}</p>}
        <ul>
          {items.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                aria-pressed={mail.selected === message.id}
                onClick={() => mail.setSelected(message.id)}
              >
                <span className={styles.sender}>{message.from}</span>
                <time>{formatTime(message.receivedAt)}</time>
                <strong className={message.read ? styles.read : undefined}>
                  {message.subject || t('noSubject')}
                </strong>
              </button>
            </li>
          ))}
        </ul>
        <footer>
          <button type="button" disabled={mail.offset === 0} onClick={() => mail.nextPage(-1)}>
            {t('previous')}
          </button>
          <button
            type="button"
            disabled={mail.messages.length < 100}
            onClick={() => mail.nextPage(1)}
          >
            {t('loadMore')}
          </button>
        </footer>
      </section>
      <section className={styles.reader} aria-label={t('selectMessage')} aria-busy={mail.loading}>
        {mail.loading && <p role="status">{t('loading')}</p>}
        {mail.bodyError != null && (
          <p role="alert" className={styles.error}>
            {t(api.errorKey(mail.bodyError))}
          </p>
        )}
        {!mail.selected && <p className={styles.empty}>{t('selectMessage')}</p>}
        {mail.detail && (
          <>
            <header>
              <h2>{mail.detail.subject || t('noSubject')}</h2>
              <p>
                {t('from')}: {mail.detail.from}
              </p>
              <p>
                {t('to')}: {mail.detail.to}
              </p>
              <time>{formatTime(mail.detail.receivedAt)}</time>
            </header>
            <div className={styles.body}>{mail.detail.body}</div>
            {(mail.detail.attachments?.length ?? 0) > 0 && (
              <section aria-label={t('attachments')}>
                <h3>{t('attachments')}</h3>
                {mail.detail.attachments?.map((attachment) => (
                  <button
                    className={styles.attachment}
                    key={attachment.id}
                    type="button"
                    disabled={saving !== ''}
                    onClick={() => void save(attachment.id)}
                  >
                    {t('saveAttachment')}: {attachment.filename} (
                    {Math.ceil(attachment.size / 1024)} KiB)
                  </button>
                ))}
              </section>
            )}
            {saveError != null && (
              <p role="alert" className={styles.error}>
                {t(api.errorKey(saveError))}
              </p>
            )}
            <p className={styles.hint}>{t('cacheHint')}</p>
          </>
        )}
      </section>
    </>
  );
}

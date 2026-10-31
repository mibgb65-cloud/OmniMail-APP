import { useState } from 'react';
import * as api from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { MailHeader } from './MailHeader';
import type { MailHeaderStar } from './MailHeader';
import { MailBody } from './MailBody';
import type { ReaderPageOptions } from './MailReaderTransition';
import styles from './MailContent.module.css';

export function MailReaderPage({
  detail,
  options,
  busy,
  onRefresh,
  star,
}: {
  detail: api.MailDetail;
  options: ReaderPageOptions;
  busy: boolean;
  onRefresh: () => void;
  star?: MailHeaderStar;
}) {
  const { t } = useTranslation('mail');
  const [saving, setSaving] = useState('');
  const [error, setError] = useState<unknown>();
  const save = async (id: string) => {
    if (!options.interactive) return;
    setSaving(id);
    setError(undefined);
    try {
      await api.saveAttachment(id);
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving('');
    }
  };
  return (
    <>
      <MailHeader
        subject={detail.subject}
        from={detail.from}
        to={detail.to}
        receivedAt={detail.receivedAt}
        interactive={options.interactive}
        star={star}
      />
      {(detail.bodyVersion ?? 0) < 1 && (
        <div className={styles['reader-error']} data-mail-reveal>
          <p className={styles.hint}>{t('legacyBody')}</p>
          <button type="button" disabled={busy || !options.interactive} onClick={onRefresh}>
            {t('refreshRichBody')}
          </button>
        </div>
      )}
      <MailBody
        id={detail.id}
        html={detail.bodyHtml}
        text={detail.body}
        interactive={options.interactive}
        transitionManaged={options.transitionManaged}
        onReady={options.onReady}
        onSlow={options.onSlow}
      />
      {(detail.attachments?.length ?? 0) > 0 && (
        <section aria-label={t('attachments')} data-mail-reveal>
          <h3>{t('attachments')}</h3>
          {detail.attachments?.map((attachment) => (
            <button
              className={styles.attachment}
              key={attachment.id}
              type="button"
              disabled={!options.interactive || saving !== ''}
              onClick={() => void save(attachment.id)}
            >
              {t('saveAttachment')}: {attachment.filename} ({Math.ceil(attachment.size / 1024)} KiB)
            </button>
          ))}
        </section>
      )}
      {error != null && (
        <p role="alert" className={styles.error} data-mail-reveal>
          {t(api.errorKey(error))}
        </p>
      )}
    </>
  );
}

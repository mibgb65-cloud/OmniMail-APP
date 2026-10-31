import { useEffect, useRef, useState } from 'react';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { copyMailAddresses, mailAddressesForCopy } from '../lib/bridge/clipboard';
import { useTranslation } from '../lib/i18n/useTranslation';
import styles from './MailHeader.module.css';

export interface MailHeaderStar {
  starred: boolean;
  pending: boolean;
  toggle: () => void;
}

function AddressRow({
  value,
  kind,
  interactive,
}: {
  value: string;
  kind: 'from' | 'to';
  interactive: boolean;
}) {
  const { t } = useTranslation('mail');
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const available = mailAddressesForCopy(value) !== undefined;
  const label = t(kind === 'from' ? 'copySender' : 'copyRecipients');
  const fullHint = `${label}\n${value.trim()}`;
  const tooltip =
    status === 'copied'
      ? t('addressCopied')
      : status === 'copying'
        ? t('addressCopying')
        : fullHint.length > 1024
          ? `${fullHint.slice(0, 1023)}…`
          : fullHint;
  const copy = async () => {
    if (pending.current || !available || !interactive) return;
    pending.current = true;
    setStatus('copying');
    try {
      await copyMailAddresses(value);
      if (mounted.current) setStatus('copied');
    } catch {
      if (mounted.current) setStatus('failed');
    } finally {
      pending.current = false;
    }
  };
  return (
    <div className={styles.address}>
      <span className={styles.label}>{t(kind)}</span>
      <div className={styles['address-content']}>
        <span className={styles.value}>{value.trim() || '—'}</span>
        <button
          type="button"
          className={styles.copy}
          aria-label={label}
          data-tooltip={tooltip}
          aria-busy={status === 'copying'}
          disabled={!interactive || !available || status === 'copying'}
          onClick={() => void copy()}
        >
          <UiIcon name={status === 'copied' ? 'check' : 'copy'} size={14} />
        </button>
        {status === 'copied' && (
          <span className={styles.feedback} role="status">
            {t('addressCopied')}
          </span>
        )}
      </div>
      {status === 'failed' && (
        <span className={styles.failure} role="alert">
          {t('addressCopyFailed')}
        </span>
      )}
    </div>
  );
}

export function MailHeader({
  subject,
  from,
  to,
  receivedAt,
  interactive = true,
  star,
}: {
  subject: string;
  from: string;
  to: string;
  receivedAt: number;
  interactive?: boolean;
  star?: MailHeaderStar;
}) {
  const { t, locale } = useTranslation('mail');
  const date = new Date(receivedAt);
  const valid = Number.isFinite(date.getTime());
  const formatted = valid
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—';
  return (
    <header className={styles.header}>
      <div className={styles.heading} data-mail-reveal>
        <h2>{subject.trim() || t('noSubject')}</h2>
        {star && (
          <button
            type="button"
            className={styles.star}
            aria-label={t(star.starred ? 'unstarAction' : 'starAction')}
            aria-pressed={star.starred}
            aria-busy={star.pending}
            data-tooltip={t(
              star.pending ? 'starSaving' : star.starred ? 'unstarAction' : 'starAction',
            )}
            disabled={!interactive || star.pending}
            onClick={() => {
              if (interactive && !star.pending) star.toggle();
            }}
          >
            <UiIcon name="starred" size={18} selected={star.starred} />
          </button>
        )}
      </div>
      <div className={styles.metadata} data-mail-reveal>
        <div className={styles.addresses}>
          <AddressRow key={`from:${from}`} kind="from" value={from} interactive={interactive} />
          <AddressRow key={`to:${to}`} kind="to" value={to} interactive={interactive} />
        </div>
        <time className={styles.time} dateTime={valid ? date.toISOString() : undefined}>
          <span className={styles['time-label']}>{t('mailTime')}</span>
          <span>{formatted}</span>
        </time>
      </div>
    </header>
  );
}

import { useTranslation } from '../lib/i18n/useTranslation';
import styles from './MailSkeleton.module.css';

export function MailSkeleton({
  header = false,
  active = true,
  fill = false,
}: {
  header?: boolean;
  active?: boolean;
  fill?: boolean;
}) {
  const { t } = useTranslation('mail');
  return (
    <div
      className={styles.skeleton}
      data-active={active}
      data-fill={fill}
      role="status"
      aria-label={t('bodyPreparing')}
    >
      <span className={styles['screen-reader-only']}>{t('bodyPreparing')}</span>
      <div aria-hidden="true" className={styles.art}>
        {header && (
          <div className={styles.heading}>
            <span />
            <span />
          </div>
        )}
        <div className={styles.lines}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.cover} />
        <div className={styles.lines}>
          <span />
          <span />
        </div>
        {fill &&
          [0, 1].map((group) => (
            <div
              key={group}
              data-skeleton-continuation
              className={`${styles.lines} ${styles.continuation}`}
            >
              <span />
              <span />
              <span />
            </div>
          ))}
      </div>
    </div>
  );
}

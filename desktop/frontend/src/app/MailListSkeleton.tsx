import { useTranslation } from '../lib/i18n/useTranslation';
import shared from './MailSkeleton.module.css';
import styles from './MailListSkeleton.module.css';

export function MailListSkeleton() {
  const { t } = useTranslation('mail');
  return (
    <div
      className={`${shared.skeleton} ${styles.skeleton}`}
      data-list-skeleton="true"
      role="status"
      aria-label={t('loading')}
    >
      <span className={shared['screen-reader-only']}>{t('loading')}</span>
      <div className={styles.rows} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <div className={styles.row} key={index}>
            <div className={styles.header}>
              <span className={styles.avatar} />
              <span className={styles.sender} />
              <div className={styles.timestamp}>
                <span className={styles.date} />
                <span className={styles.clock} />
              </div>
            </div>
            <span className={styles.subject} />
            <span className={styles.tail} />
          </div>
        ))}
      </div>
    </div>
  );
}

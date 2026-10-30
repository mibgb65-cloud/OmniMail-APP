import * as api from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import type { AccountFormState } from './useAccountForm';
import styles from './MailDialogs.module.css';
import wizard from './AccountDialog.module.css';

export function BatchAccountResults({
  form,
}: {
  form: Omit<AccountFormState, 'request' | 'errorRef'>;
}) {
  const { t } = useTranslation('mail');
  return (
    <section className={wizard['batch-results']} aria-label={t('batchProgressTitle')}>
      <p role="status">
        {form.batch.running
          ? t('batchRunning', {
              done: form.batchAdded + form.batchFailed + form.batchReview,
              total: form.drafts.length,
            })
          : t('batchAddedSummary', { count: form.batchAdded })}
      </p>
      <ol>
        {form.drafts.map((draft, index) => {
          const result = form.batch.results[draft.id];
          const added = result?.status === 'added';
          const syncCode = added ? result.account.sync.errorCode : '';
          const syncError = syncCode !== '' && syncCode !== 'BUSY';
          return (
            <li key={draft.id}>
              <div className={wizard['batch-result-row']}>
                <strong>
                  {index + 1}. {added ? result.account.email : draft.email}
                </strong>
                <span>
                  {t(
                    added
                      ? 'batchAdded'
                      : result?.status === 'review'
                        ? 'batchReview'
                        : result?.status === 'failed'
                          ? 'batchFailed'
                          : result?.status === 'verifying'
                            ? 'batchVerifying'
                            : 'batchQueued',
                  )}
                </span>
              </div>
              {result?.status === 'failed' && (
                <p className={styles.error}>{t(api.errorKey(result.errorCode))}</p>
              )}
              {added && (
                <p className={syncError ? styles.error : styles.hint}>
                  {syncError ? t(api.errorKey(syncCode)) : t('batchSyncScheduled')}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.hint}>{t(form.batch.running ? 'batchCloseHint' : 'batchSyncHint')}</p>
    </section>
  );
}

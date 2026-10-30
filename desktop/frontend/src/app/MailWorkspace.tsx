import { useId, useState } from 'react';

import { UiIcon } from '../components/UiIcon/UiIcon';
import { useTranslation } from '../lib/i18n/useTranslation';
import { MailToolbar } from './MailToolbar';
import styles from './MailWorkspace.module.css';
import { MailContent } from './MailContent';
import type { MailController } from './useMail';
import { MailConnectionState, mailSyncState } from './MailAccountNotice';

export function MailWorkspace({ mail }: { mail?: MailController } = {}) {
  const { t } = useTranslation('workspace');
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const analysisId = useId();

  return (
    <div className={styles.layout}>
      <section className={styles.mail} aria-label={t('mailArea')}>
        <MailToolbar
          onSync={mail?.ready && mail.accounts.length ? () => void mail.sync() : undefined}
          syncState={mail ? mailSyncState(mail) : 'idle'}
          syncBusy={
            mail?.syncRequested ||
            mail?.accounts.some(
              (account) =>
                (!mail.accountId || mail.accountId === account.id) && account.sync.running,
            )
          }
          count={mail?.ready ? mail.messages.length : undefined}
          query={mail?.ready ? mail.filter : undefined}
          onQuery={mail?.ready ? mail.setFilter : undefined}
        />
        <div className={styles.panes}>
          {mail?.ready ? (
            <MailContent mail={mail} />
          ) : mail ? (
            <MailConnectionState mail={mail} />
          ) : (
            <>
              <section className={styles.list} aria-labelledby="mail-list-title">
                <header className={styles['section-header']}>
                  <h2 id="mail-list-title">{t('mailListTitle')}</h2>
                </header>
                <div className={styles['list-empty']}>
                  <div className={styles['small-icon']}>
                    <UiIcon name="inbox" size={22} />
                  </div>
                  <strong>{t('mailListEmpty')}</strong>
                  <p>{t('mailListHint')}</p>
                </div>
                <div className={styles['list-footer']}>{t('previewLabel')}</div>
              </section>
              <section className={styles.reader} aria-label={t('readerTitle')}>
                <header className={styles['reader-header']}>
                  <span>{t('readerTitle')}</span>
                  <span className={styles.badge}>{t('previewLabel')}</span>
                </header>
                <div className={styles['reader-empty']}>
                  <div className={styles['hero-icon']}>
                    <UiIcon name="mailOpen" size={28} />
                  </div>
                  <h2>{t('readerEmpty')}</h2>
                  <p>{t('readerHint')}</p>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
      <aside className={styles.analysis} aria-label={t('analysisTitle')}>
        <header className={styles['analysis-header']}>
          {analysisOpen && (
            <div className={styles['analysis-title']}>
              <span className={styles['ai-icon']}>
                <UiIcon name="sparkles" size={18} />
              </span>
              <div>
                <h2>{t('analysisTitle')}</h2>
                <p>{t('analysisSubtitle')}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            className={styles.toggle}
            aria-label={t(analysisOpen ? 'collapseAnalysis' : 'expandAnalysis')}
            data-tooltip={t(analysisOpen ? 'collapseAnalysis' : 'expandAnalysis')}
            aria-expanded={analysisOpen}
            aria-controls={analysisId}
            onClick={() => setAnalysisOpen((open) => !open)}
          >
            <UiIcon name={analysisOpen ? 'panelRightClose' : 'panelRightOpen'} />
          </button>
        </header>
        <div id={analysisId} hidden={!analysisOpen} className={styles['analysis-content']}>
          <div className={styles['analysis-empty']}>
            <span className={styles['ai-orb']}>
              <UiIcon name="sparkles" size={25} />
            </span>
            <h3>{t('analysisEmpty')}</h3>
            <p>{t('analysisHint')}</p>
          </div>
          <div className={styles['analysis-note']}>
            <UiIcon name="about" size={16} />
            <span>{t('analysisUnavailable')}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

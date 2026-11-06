import { useId, useState } from 'react';

import { UiIcon } from '../components/UiIcon/UiIcon';
import { useTranslation } from '../lib/i18n/useTranslation';
import { MailToolbar } from './MailToolbar';
import styles from './MailWorkspace.module.css';
import { MailContent } from './MailContent';
import type { MailController } from './useMail';
import { MailConnectionState, mailSyncState } from './MailAccountNotice';
import type { Composer } from './useComposer';
import { errorKey } from '../lib/bridge/mail';
import { MailAIPanel } from '../components/MailAI/MailAIPanel';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';
import { TasksDialog } from '../components/Tasks/TasksDialog';

export function MailWorkspace({
  mail,
  composer,
}: { mail?: MailController; composer?: Composer } = {}) {
  const { t } = useTranslation('workspace');
  const { t: mailText } = useTranslation('mail');
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const analysisId = useId();
  const [tasksOpen, setTasksOpen] = useState(false);
  const { t: taskText } = useTranslation('tasks');

  return (
    <>
      <div className={styles.layout} data-composing={composer?.visible ? 'true' : undefined}>
        <section className={styles.mail} aria-label={t('mailArea')}>
          {composer?.session &&
            !composer.visible &&
            (composer.session.status !== 'editing' || composer.session.error != null) && (
              <div
                className={styles['compose-notice']}
                role={composer.session.error != null ? 'alert' : 'status'}
              >
                <span>
                  {composer.session.error != null
                    ? mailText(errorKey(composer.session.error))
                    : mailText(composer.session.status === 'sent' ? 'sent' : 'sending')}
                </span>
                <button type="button" onClick={composer.show}>
                  {mailText('composeViewStatus')}
                </button>
                {composer.session.status === 'sent' && (
                  <button type="button" onClick={composer.discard}>
                    {mailText('close')}
                  </button>
                )}
              </div>
            )}
          <MailToolbar
            suspendWrites={!!composer?.visible}
            controller={mail?.ready ? mail : undefined}
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
              <MailContent mail={mail} composer={composer} />
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
        <aside
          className={styles.analysis}
          hidden={composer?.visible}
          aria-label={t('analysisTitle')}
        >
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
          {analysisOpen && mail?.ready && (
            <button
              type="button"
              data-button-variant="secondary"
              onClick={() => setTasksOpen(true)}
            >
              {taskText('open')}
            </button>
          )}
          <ScrollArea
            id={analysisId}
            hidden={!analysisOpen}
            className={styles['analysis-scroll']}
            viewportClassName={styles['analysis-content']}
          >
            {mail?.ready ? (
              <MailAIPanel
                key={mail.selected}
                detail={mail.detail}
                selectedId={mail.selected}
                suspended={!analysisOpen || !!composer?.visible}
                onAdopt={
                  composer
                    ? (body) => composer.adoptDraft(mail.detail?.accountId ?? mail.accountId, body)
                    : undefined
                }
                hasDraft={composer?.hasSession}
                hasSender={mail.accounts.some((account) => account.status === 'configured')}
              />
            ) : (
              <p>{t('analysisHint')}</p>
            )}
          </ScrollArea>
        </aside>
      </div>
      {tasksOpen && mail && (
        <TasksDialog
          accounts={mail.accounts}
          mails={mail.messages}
          onClose={() => setTasksOpen(false)}
        />
      )}
    </>
  );
}

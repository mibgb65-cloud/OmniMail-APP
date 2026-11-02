import { useEffect, useId, useRef } from 'react';
import * as api from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { ComposeSender } from './ComposeSender';
import { ComposeConfirmation } from './ComposeConfirmation';
import type { Composer } from './useComposer';
import styles from './ComposePanel.module.css';

export function ComposePanel({
  composer,
  accounts,
}: {
  composer: Composer;
  accounts: api.AccountSummary[];
}) {
  const { t } = useTranslation('mail');
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const to = useRef<HTMLInputElement>(null);
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const previousVisible = useRef(false);
  const previousStatus = useRef(composer.session?.status);
  const returnRequested = useRef(false);
  const session = composer.session;
  const locked = session?.status !== 'editing' || !!composer.confirmation;
  useEffect(() => {
    const opening =
      composer.visible &&
      (!previousVisible.current ||
        (previousStatus.current === 'sent' && session?.status === 'editing'));
    previousVisible.current = composer.visible;
    previousStatus.current = session?.status;
    if (!composer.visible) {
      if (returnRequested.current) {
        root.current?.parentElement
          ?.querySelector<HTMLElement>('[data-custom-scrollbar][role="region"]')
          ?.focus({ preventScroll: true });
        returnRequested.current = false;
      }
      return;
    }
    if (!opening && !composer.invalidField) return;
    if (composer.invalidField === 'body') body.current?.focus();
    else if (composer.invalidField === 'subject') subject.current?.focus();
    else if (composer.invalidField === 'accountId' || !composer.senderAvailable)
      root.current?.querySelector<HTMLElement>('[role="combobox"]')?.focus();
    else to.current?.focus();
  }, [composer.visible, composer.invalidField, composer.senderAvailable, session?.status]);
  if (!session) return null;
  return (
    <section
      ref={root}
      className={styles.panel}
      hidden={!composer.visible}
      aria-label={t('composeTitle')}
      data-compose-workspace
    >
      <header className={styles.header}>
        <div>
          <h2>{t('composeTitle')}</h2>
          <small>{t('composePlainText')}</small>
        </div>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            returnRequested.current = true;
            composer.hide();
          }}
        >
          <UiIcon name="previous" size={16} />
          {t('composeReturn')}
        </button>
      </header>
      <form
        className={styles.form}
        noValidate
        aria-busy={session.status === 'sending'}
        onSubmit={(event) => {
          event.preventDefault();
          void composer.requestSend();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.key !== 'Enter') return;
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            void composer.requestSend();
          } else if (event.target === to.current || event.target === subject.current) {
            event.preventDefault();
            if (event.target === to.current) subject.current?.focus();
            else body.current?.focus();
          }
        }}
      >
        <div className={styles.content} data-native-scrollbar="">
          <fieldset className={styles.fields}>
            <ComposeSender
              accounts={accounts}
              value={session.accountId}
              disabled={locked}
              onChange={(value) => composer.update('accountId', value)}
            />
            {!composer.senderAvailable && (
              <p className={styles.warning}>{t('composeSenderUnavailable')}</p>
            )}
            <label className={styles.field} htmlFor={`${id}-to`}>
              <span>{t('to')}</span>
              <input
                id={`${id}-to`}
                ref={to}
                value={session.to}
                readOnly={locked}
                maxLength={8192}
                aria-describedby={`${id}-to-hint`}
                aria-invalid={composer.invalidField === 'to'}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => composer.update('to', event.currentTarget.value)}
              />
            </label>
            <small id={`${id}-to-hint`} className={styles.toHint}>
              {t('composeToHint')}
            </small>
            <label className={styles.field} htmlFor={`${id}-subject`}>
              <span>{t('subject')}</span>
              <input
                id={`${id}-subject`}
                ref={subject}
                value={session.subject}
                readOnly={locked}
                maxLength={512}
                aria-invalid={composer.invalidField === 'subject'}
                onChange={(event) => composer.update('subject', event.currentTarget.value)}
              />
            </label>
          </fieldset>
          <div className={styles.editor}>
            <label className={styles.bodyLabel} htmlFor={`${id}-body`}>
              {t('body')}
            </label>
            <textarea
              id={`${id}-body`}
              ref={body}
              value={session.body}
              readOnly={locked}
              maxLength={1_048_576}
              aria-invalid={composer.invalidField === 'body'}
              onChange={(event) => composer.update('body', event.currentTarget.value)}
            />
          </div>
          <div className={styles.feedback} aria-live="polite">
            {session.error != null && <p role="alert">{t(api.errorKey(session.error))}</p>}
            {session.status === 'sent' && <p role="status">{t('sent')}</p>}
          </div>
          <p className={styles.sessionHint}>
            {t(session.status === 'sent' ? 'composeHint' : 'composeSessionHint')}
          </p>
        </div>
        <footer className={styles.footer}>
          {session.status === 'sent' ? (
            <button
              type="button"
              className={styles.send}
              onClick={() => composer.open(session.accountId)}
            >
              {t('composeWriteAnother')}
            </button>
          ) : (
            <button
              type="submit"
              className={styles.send}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              disabled={locked || !composer.senderAvailable || !session.to.trim()}
            >
              <UiIcon name="sent" size={16} />
              {session.status === 'sending' ? t('sending') : t('send')}
            </button>
          )}
          <small className={styles.shortcut}>{t('composeSendShortcut')}</small>
          <button
            type="button"
            className={styles.discard}
            disabled={session.status === 'sending'}
            onClick={composer.discard}
          >
            <UiIcon name={session.status === 'sent' ? 'close' : 'deleted'} size={16} />
            {t(session.status === 'sent' ? 'close' : 'composeDiscard')}
          </button>
        </footer>
      </form>
      {composer.visible && composer.confirmation && <ComposeConfirmation composer={composer} />}
    </section>
  );
}

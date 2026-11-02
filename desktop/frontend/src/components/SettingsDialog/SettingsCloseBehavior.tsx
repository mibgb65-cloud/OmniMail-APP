import { useId, useRef, useState } from 'react';
import { setCloseMode, type CloseMode } from '../../lib/bridge/windowLifecycle';
import { useWindowCloseState } from '../../lib/preferences/useWindowCloseState';
import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './SettingsDialog.module.css';
import { SettingsSegments } from './SettingsSegments';
import segments from './SettingsSegments.module.css';

export function SettingsCloseBehavior() {
  const { t } = useTranslation('settings');
  const id = useId();
  const { state, refresh } = useWindowCloseState();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const value = state.value;
  const select = (mode: CloseMode) => {
    if (pending.current || !value || value.pending) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    void setCloseMode(mode)
      .then(
        () => refresh(),
        () => setError(true),
      )
      .finally(() => {
        pending.current = false;
        setBusy(false);
      });
  };
  return (
    <div className={styles.row}>
      <div className={styles.copy}>
        <strong id={`${id}-label`}>{t('closeBehavior')}</strong>
        <p id={`${id}-hint`}>{t('closeBehaviorDescription')}</p>
        {state.status === 'unavailable' && <p>{t('closeDesktopOnly')}</p>}
        {(error || state.status === 'error') && <p role="alert">{t('closeSettingsError')}</p>}
      </div>
      <div className={segments.control}>
        <SettingsSegments<CloseMode>
          value={value?.mode}
          onChange={select}
          labelledBy={`${id}-label`}
          describedBy={`${id}-hint`}
          disabled={busy || !value || value.pending}
          busy={busy || state.status === 'loading'}
          options={[
            { value: 'ask', label: t('closeAsk'), shortLabel: t('closeAskShort'), icon: 'about' },
            {
              value: 'quit',
              label: t('closeQuit'),
              shortLabel: t('closeQuitShort'),
              icon: 'close',
            },
            {
              value: 'background',
              label: t('closeBackground'),
              shortLabel: t('closeBackgroundShort'),
              icon: 'monitor',
              disabled: !value?.backgroundAvailable,
            },
          ]}
        />
        {state.status === 'loading' && <span role="status">{t('closeSettingsLoading')}</span>}
        {state.status === 'error' && (
          <button type="button" onClick={refresh}>
            {t('closeRetry')}
          </button>
        )}
      </div>
    </div>
  );
}

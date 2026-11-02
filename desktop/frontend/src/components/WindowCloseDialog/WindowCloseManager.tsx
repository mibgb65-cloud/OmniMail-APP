import { useWindowCloseState } from '../../lib/preferences/useWindowCloseState';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { WindowCloseDialog } from './WindowCloseDialog';
import styles from './WindowCloseDialog.module.css';

export function WindowCloseManager() {
  const { state, refresh } = useWindowCloseState();
  const { t } = useTranslation('settings');
  if (state.value?.pending) {
    return (
      <WindowCloseDialog
        backgroundAvailable={state.value.backgroundAvailable}
        onResolved={refresh}
      />
    );
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className={styles.notice}>
        {t('closeSettingsError')}
        <button type="button" onClick={refresh}>
          {t('closeRetry')}
        </button>
      </div>
    );
  }
  return null;
}

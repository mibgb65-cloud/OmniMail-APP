import { useId, useState } from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';
import {
  setMailFollowsDarkMode,
  useMailFollowsDarkMode,
} from '../../lib/preferences/mailAppearance';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './SettingsDialog.module.css';

export function SettingsMailAppearance() {
  const { t } = useTranslation('settings');
  const followDarkMode = useMailFollowsDarkMode();
  const id = useId();
  const [notSaved, setNotSaved] = useState(false);
  return (
    <div className={styles.row}>
      <div className={styles.copy}>
        <strong id={`${id}-label`}>{t('mailFollowsDarkMode')}</strong>
        <p id={`${id}-hint`}>{t('mailFollowsDarkModeHint')}</p>
        {notSaved && <p role="alert">{t('mailAppearanceNotSaved')}</p>}
      </div>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        aria-checked={followDarkMode}
        onClick={() => setNotSaved(!setMailFollowsDarkMode(!followDarkMode))}
      >
        <span aria-hidden="true">{followDarkMode && <UiIcon name="check" size={16} />}</span>
      </button>
    </div>
  );
}

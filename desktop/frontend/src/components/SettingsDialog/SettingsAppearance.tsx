import { useId, useState } from 'react';
import type { ThemePreference } from '../../lib/theme/theme';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { SettingsSegments } from './SettingsSegments';
import settings from './SettingsDialog.module.css';
import styles from './SettingsSegments.module.css';

export interface SettingsAppearanceProps {
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => boolean;
}

const options = [
  { value: 'light', label: 'lightMode', shortLabel: 'lightModeShort', icon: 'sun' },
  { value: 'dark', label: 'darkMode', shortLabel: 'darkModeShort', icon: 'moon' },
  { value: 'system', label: 'systemMode', shortLabel: 'systemModeShort', icon: 'monitor' },
] as const;

export function SettingsAppearance({
  themePreference,
  onThemePreferenceChange,
}: SettingsAppearanceProps) {
  const { t } = useTranslation('settings');
  const id = useId();
  const [notSaved, setNotSaved] = useState(false);
  const select = (preference: ThemePreference) => {
    setNotSaved(!onThemePreferenceChange(preference));
  };

  return (
    <div className={settings.row}>
      <div className={settings.copy}>
        <strong id={`${id}-label`}>{t('appearance')}</strong>
        <p id={`${id}-hint`}>{t('appearanceDescription')}</p>
      </div>
      <div className={styles.control}>
        <SettingsSegments
          value={themePreference}
          onChange={select}
          labelledBy={`${id}-label`}
          describedBy={`${id}-hint`}
          options={options.map((option) => ({
            ...option,
            label: t(option.label),
            shortLabel: t(option.shortLabel),
          }))}
        />
        {notSaved && (
          <p className={styles.hint} role="alert">
            {t('appearanceNotSaved')}
          </p>
        )}
      </div>
    </div>
  );
}

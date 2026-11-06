import { useTranslation } from '../../lib/i18n/useTranslation';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './SettingsDialog.module.css';

export const settingsSections = [
  'general',
  'accounts',
  'notifications',
  'reading',
  'ai',
  'storage',
  'about',
  'updates',
] as const;
export type SettingsSection = (typeof settingsSections)[number];
const sections = settingsSections;

function at(position: number, fallback: SettingsSection): SettingsSection {
  return sections.find((_name, index) => index === position) ?? fallback;
}

const titles = {
  general: 'generalTitle',
  accounts: 'accountsTitle',
  notifications: 'notificationsTitle',
  reading: 'readingTitle',
  ai: 'aiTitle',
  storage: 'storageTitle',
  about: 'aboutTitle',
  updates: 'updatesTitle',
} as const;

const icons = {
  general: 'general',
  accounts: 'accounts',
  notifications: 'bell',
  reading: 'mailOpen',
  ai: 'sparkles',
  storage: 'storage',
  about: 'about',
  updates: 'sync',
} as const;

interface SettingsNavigationProps {
  id: string;
  section: SettingsSection;
  onChange: (section: SettingsSection) => void;
}

export function SettingsNavigation({ id, section, onChange }: SettingsNavigationProps) {
  const { t } = useTranslation('settings');
  return (
    <aside className={styles.navigation}>
      <ScrollArea
        className={styles['navigation-scroll']}
        viewportClassName={styles['navigation-viewport']}
      >
        <p className={styles['navigation-title']}>{t('navigationTitle')}</p>
        <div
          role="tablist"
          aria-label={t('navigationTitle')}
          aria-orientation="vertical"
          onKeyDown={(event) => {
            const current = sections.indexOf(section);
            let next: SettingsSection;
            if (event.key === 'Home') next = at(0, section);
            else if (event.key === 'End') next = at(sections.length - 1, section);
            else if (event.key === 'ArrowDown') next = at((current + 1) % sections.length, section);
            else if (event.key === 'ArrowUp') {
              next = at((current - 1 + sections.length) % sections.length, section);
            } else return;
            event.preventDefault();
            onChange(next);
            event.currentTarget
              .querySelector<HTMLButtonElement>(`[data-section="${next}"]`)
              ?.focus();
          }}
        >
          {sections.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              className={styles['navigation-button']}
              id={`${id}-tab-${name}`}
              aria-controls={`${id}-panel-${name}`}
              aria-selected={name === section}
              tabIndex={name === section ? 0 : -1}
              data-section={name}
              onClick={() => onChange(name)}
            >
              <UiIcon name={icons[name]} selected={name === section} />
              <span>{t(titles[name])}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

export const settingsSectionTitles = titles;

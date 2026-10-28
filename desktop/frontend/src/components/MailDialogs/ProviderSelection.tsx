import type { TFunction } from 'i18next';
import { useId } from 'react';

import type { ProviderPreset } from '../../lib/bridge/mail';
import type { Translations } from '../../lib/i18n/resources';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import styles from './AccountDialog.module.css';

// 这里只定义展示信息；可用服务商及端点仍以 Providers 返回值为准。
const PROVIDER_LABELS = new Map<string, { label: keyof Translations['mail']; mark: string }>([
  ['gmail', { label: 'providerGmail', mark: 'G' }],
  ['qq', { label: 'providerQQ', mark: 'QQ' }],
  ['netease_163', { label: 'provider163', mark: '163' }],
  ['netease_126', { label: 'provider126', mark: '126' }],
  ['custom', { label: 'customProvider', mark: '' }],
]);

export function getProviderLabel(preset: ProviderPreset, t: TFunction<'mail'>) {
  const key = PROVIDER_LABELS.get(preset.code)?.label;
  return key ? t(key) : preset.name;
}

export function ProviderSelection({
  presets,
  status,
  onSelect,
  onRetry,
}: {
  presets: ProviderPreset[];
  status: 'loading' | 'success' | 'error';
  onSelect: (code: string) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation('mail');
  const id = useId();
  if (status !== 'success' || presets.length === 0) {
    return (
      <div className={styles.state}>
        {status !== 'error' && (
          <p role="status">{t(status === 'loading' ? 'loadingProviders' : 'noProviders')}</p>
        )}
        {status !== 'loading' && (
          <button type="button" className={styles.secondary} onClick={onRetry}>
            {t('retryProviders')}
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      {(['preset', 'custom'] as const).map((kind) => {
        const values = presets.filter(
          (preset) => (preset.code === 'custom') === (kind === 'custom'),
        );
        if (!values.length) return null;
        return (
          <section
            key={kind}
            className={styles.section}
            aria-label={t(kind === 'preset' ? 'presetProviders' : 'customProviders')}
          >
            <h4 className={styles['section-title']}>
              {t(kind === 'preset' ? 'presetProviders' : 'customProviders')}
            </h4>
            <div className={kind === 'preset' ? styles.grid : styles['custom-grid']}>
              {values.map((preset, index) => (
                <button
                  key={preset.code}
                  type="button"
                  className={styles['provider-card']}
                  aria-label={getProviderLabel(preset, t)}
                  aria-describedby={`${id}-${kind}-${index}`}
                  onClick={() => onSelect(preset.code)}
                >
                  <span className={styles.mark} aria-hidden="true">
                    {PROVIDER_LABELS.get(preset.code)?.mark || (
                      <UiIcon name={kind === 'custom' ? 'general' : 'mailOpen'} />
                    )}
                  </span>
                  <span className={styles['card-copy']}>
                    <strong>{getProviderLabel(preset, t)}</strong>
                    <span id={`${id}-${kind}-${index}`}>
                      {t(
                        kind === 'custom'
                          ? 'customProviderDescription'
                          : preset.code === 'gmail'
                            ? 'gmailProviderDescription'
                            : 'presetProviderDescription',
                      )}
                    </span>
                  </span>
                  <UiIcon name="next" className={styles.chevron} />
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

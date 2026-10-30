import type { TFunction } from 'i18next';
import { useId } from 'react';

import type { ProviderPreset } from '../../lib/bridge/mail';
import type { Translations } from '../../lib/i18n/resources';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import { detectEmailProvider, normalizeAccountEmail } from './providerDetection';
import { AccountInput } from './AccountFormValidation';
import styles from './AccountDialog.module.css';

// 这里只定义展示信息；可用服务商及端点仍以 Providers 返回值为准。
const PROVIDER_LABELS = new Map<string, { label: keyof Translations['mail']; icon?: string }>([
  ['gmail', { label: 'providerGmail', icon: '/providers/gmail.ico' }],
  ['qq', { label: 'providerQQ', icon: '/providers/qq.ico' }],
  ['netease_163', { label: 'provider163', icon: '/providers/netease-163.png' }],
  ['netease_126', { label: 'provider126', icon: '/providers/netease-126.png' }],
  ['custom', { label: 'customProvider' }],
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
  email,
  onEmailChange,
}: {
  presets: ProviderPreset[];
  status: 'loading' | 'success' | 'error';
  onSelect: (code: string) => void;
  onRetry: () => void;
  email: string;
  onEmailChange: (email: string) => void;
}) {
  const { t } = useTranslation('mail');
  const id = useId();
  const detected = detectEmailProvider(email, presets);
  const validEmail = normalizeAccountEmail(email);
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
      <div className={styles['email-entry']}>
        <AccountInput
          label={t('email')}
          id={`${id}-email`}
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          placeholder={t('emailPlaceholder')}
          aria-describedby={`${id}-detection`}
          value={email}
          onChange={(event) => onEmailChange(event.currentTarget.value)}
          action={
            <button type="submit" disabled={!detected}>
              {t('continueWithEmail')}
              <UiIcon name="next" />
            </button>
          }
        />
        <p id={`${id}-detection`} className={styles.detection} role="status">
          {detected
            ? detected.code === 'custom'
              ? t('emailCustomProvider')
              : t('emailDetectedProvider', { provider: getProviderLabel(detected, t) })
            : t(validEmail ? 'emailProviderUnavailable' : 'emailDetectionHint')}
        </p>
      </div>
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
                    {PROVIDER_LABELS.get(preset.code)?.icon ? (
                      <img
                        src={PROVIDER_LABELS.get(preset.code)?.icon}
                        alt=""
                        width={28}
                        height={28}
                      />
                    ) : (
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

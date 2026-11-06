import type { ServerInput } from '../../../bindings/omnimail/desktop/internal/service/models';
import * as api from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { AccountInput, AccountSelect } from './AccountFormValidation';
import styles from './MailDialogs.module.css';

export function ServerFields({
  label,
  value,
  onChange,
  credentials = true,
  connection = true,
}: {
  label: string;
  value: ServerInput;
  onChange: (value: ServerInput) => void;
  credentials?: boolean;
  connection?: boolean;
}) {
  const { t } = useTranslation('mail');
  return (
    <fieldset className={styles.server}>
      <legend>{label}</legend>
      {connection ? (
        <>
          <AccountInput
            label={t('host')}
            required
            maxLength={253}
            value={value.host}
            onChange={(event) => onChange({ ...value, host: event.currentTarget.value })}
          />
          <AccountInput
            label={t('port')}
            type="number"
            required
            min={1}
            max={65535}
            value={value.port}
            onChange={(event) => onChange({ ...value, port: Number(event.currentTarget.value) })}
          />
          <AccountSelect
            label={t('security')}
            fullWidth
            value={value.tlsMode}
            onChange={(event) =>
              onChange({
                ...value,
                tlsMode:
                  event.currentTarget.value === 'starttls'
                    ? api.TLSMode.TLSStartTLS
                    : api.TLSMode.TLSImplicit,
              })
            }
          >
            <option value="implicit_tls">{t('tls')}</option>
            <option value="starttls">{t('starttls')}</option>
          </AccountSelect>
        </>
      ) : (
        <p className={styles['server-summary']}>
          {value.host}:{value.port} · {t(value.tlsMode === 'starttls' ? 'starttls' : 'tls')}
        </p>
      )}
      {credentials && (
        <>
          <AccountInput
            label={t('username')}
            fullWidth
            required
            maxLength={320}
            autoComplete={`section-${label} username`}
            value={value.username}
            onChange={(event) => onChange({ ...value, username: event.currentTarget.value })}
          />
          <AccountInput
            label={t('password')}
            fullWidth
            type="password"
            required
            maxLength={1024}
            autoComplete={`section-${label} current-password`}
            value={value.password}
            onChange={(event) => onChange({ ...value, password: event.currentTarget.value })}
          />
        </>
      )}
    </fieldset>
  );
}

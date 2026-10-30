import { useEffect, useId, useRef } from 'react';
import * as api from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import type { ServerInput } from '../../../bindings/omnimail/desktop/internal/service/models';
import { UiIcon } from '../UiIcon/UiIcon';
import { getProviderLabel, ProviderSelection } from './ProviderSelection';
import { useAccountForm, type AccountFormState } from './useAccountForm';
import { useMailDialog } from './useMailDialog';
import styles from './MailDialogs.module.css';
import wizard from './AccountDialog.module.css';

function ServerFields({
  label,
  value,
  onChange,
  credentials = true,
}: {
  label: string;
  value: ServerInput;
  onChange: (value: ServerInput) => void;
  credentials?: boolean;
}) {
  const { t } = useTranslation('mail');
  return (
    <fieldset className={styles.server}>
      <legend>{label}</legend>
      <label>
        {t('host')}
        <input
          required
          maxLength={253}
          value={value.host}
          onChange={(event) => onChange({ ...value, host: event.currentTarget.value })}
        />
      </label>
      <label>
        {t('port')}
        <input
          type="number"
          required
          min={1}
          max={65535}
          value={value.port}
          onChange={(event) => onChange({ ...value, port: Number(event.currentTarget.value) })}
        />
      </label>
      <label>
        {t('security')}
        <select
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
        </select>
      </label>
      {credentials && (
        <>
          <label>
            {t('username')}
            <input
              required
              maxLength={320}
              autoComplete={`section-${label} username`}
              value={value.username}
              onChange={(event) => onChange({ ...value, username: event.currentTarget.value })}
            />
          </label>
          <label>
            {t('password')}
            <input
              type="password"
              required
              maxLength={1024}
              autoComplete={`section-${label} current-password`}
              value={value.password}
              onChange={(event) => onChange({ ...value, password: event.currentTarget.value })}
            />
          </label>
        </>
      )}
    </fieldset>
  );
}

function AccountFields({ form }: { form: Omit<AccountFormState, 'request' | 'errorRef'> }) {
  const { t } = useTranslation('mail');
  return (
    <fieldset disabled={form.busy} className={styles.fields}>
      <label>
        {t('email')}
        <input
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={form.email}
          onChange={(event) => form.changeEmail(event.currentTarget.value)}
        />
      </label>
      <label>
        {t('displayName')}
        <input
          maxLength={256}
          value={form.name}
          onChange={(event) => form.setName(event.currentTarget.value)}
        />
      </label>
      <ServerFields label="IMAP" value={form.imap} onChange={form.setIMAP} />
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={form.same}
          onChange={(event) => form.setSame(event.currentTarget.checked)}
        />
        {t('sameCredentials')}
      </label>
      <ServerFields
        label="SMTP"
        value={form.smtp}
        onChange={form.setSMTP}
        credentials={!form.same}
      />
    </fieldset>
  );
}

export function AccountDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('mail');
  const ref = useMailDialog();
  const title = useId();
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const { request, errorRef, ...form } = useAccountForm(onClose, onSaved);
  const selected = form.presets.find((preset) => preset.code === form.provider);
  const step = selected ? 2 : 1;
  useEffect(() => {
    if (form.provider) ref.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    else stepTitle.current?.focus();
  }, [form.provider, ref]);
  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wizard.dialog}`}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        request.current?.abort();
        onClose();
      }}
    >
      <form className={wizard.form} onSubmit={(event) => void form.submit(event)}>
        <header>
          <div className={wizard['header-copy']}>
            <h2 id={title}>{t('addTitle')}</h2>
            <ol className={wizard.steps} aria-label={t('accountSetupProgress')}>
              {(['providerSelectionStep', 'providerSetupStep'] as const).map((key, index) => (
                <li key={key} aria-current={step === index + 1 ? 'step' : undefined}>
                  <span className={wizard['step-number']} aria-hidden="true">
                    {index + 1}
                  </span>
                  {t(key)}
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            className={wizard.close}
            aria-label={t('close')}
            data-tooltip={t('close')}
            onClick={onClose}
          >
            <UiIcon name="close" />
          </button>
        </header>
        <div className={styles.content}>
          <h3 ref={stepTitle} tabIndex={-1} className={wizard['step-title']}>
            {selected
              ? t('configureProvider', { provider: getProviderLabel(selected, t) })
              : t('chooseProviderHeading')}
          </h3>
          <p className={wizard.description}>
            {t(selected ? 'providerSetupDescription' : 'chooseProviderDescription')}
          </p>
          {form.error != null && (
            <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
              {t(api.errorKey(form.error))}
            </p>
          )}
          {selected ? (
            <>
              <AccountFields form={form} />
              {selected.code === 'gmail' && <p className={styles.hint}>{t('googleHint')}</p>}
              <p role="status" className={styles.hint}>
                {form.busy ? t('verifying') : ''}
              </p>
            </>
          ) : (
            <ProviderSelection
              presets={form.presets}
              status={form.loadStatus}
              onSelect={form.changeProvider}
              onRetry={() => {
                stepTitle.current?.focus();
                form.retryProviders();
              }}
            />
          )}
        </div>
        <footer>
          {selected ? (
            <>
              <button
                type="button"
                className={wizard.secondary}
                disabled={form.busy}
                onClick={form.backToProviders}
              >
                {t('backProviders')}
              </button>
              <button type="submit" disabled={form.busy}>
                {t('save')}
              </button>
            </>
          ) : (
            <p className={wizard.privacy}>
              <UiIcon name="about" />
              {t('accountHint')}
            </p>
          )}
        </footer>
      </form>
    </dialog>
  );
}

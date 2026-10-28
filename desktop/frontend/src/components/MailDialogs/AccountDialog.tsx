import { useEffect, useId, useRef, useState } from 'react';
import * as api from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import type { ServerInput } from '../../../bindings/omnimail/desktop/internal/service/models';
import { useMailDialog } from './useMailDialog';
import styles from './MailDialogs.module.css';

const emptyServer = (port: number): ServerInput => ({
  host: '',
  port,
  username: '',
  password: '',
  tlsMode: api.TLSMode.TLSImplicit,
  authKind: api.AuthKind.AuthPassword,
});

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

function useAccountForm(onClose: () => void, onSaved: () => void) {
  const [presets, setPresets] = useState<api.ProviderPreset[]>([]);
  const [provider, setProvider] = useState('custom');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [imap, setIMAP] = useState(emptyServer(993));
  const [smtp, setSMTP] = useState(emptyServer(465));
  const [same, setSame] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const request = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    api
      .providers(controller.signal)
      .then(setPresets)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(error);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const changeProvider = (code: string) => {
    setProvider(code);
    const preset = presets.find((preset) => preset.code === code);
    const incoming = preset?.endpoints?.find((endpoint) => endpoint.protocol === 'imap');
    const outgoing = preset?.endpoints?.find((endpoint) => endpoint.protocol === 'smtp');
    setIMAP({
      ...emptyServer(993),
      host: incoming?.host ?? '',
      port: incoming?.port ?? 993,
      username: email,
      tlsMode: incoming?.tlsMode ?? api.TLSMode.TLSImplicit,
    });
    setSMTP({
      ...emptyServer(465),
      host: outgoing?.host ?? '',
      port: outgoing?.port ?? 465,
      username: email,
      tlsMode: outgoing?.tlsMode ?? api.TLSMode.TLSImplicit,
    });
  };
  const changeEmail = (value: string) => {
    if (!imap.username || imap.username === email) setIMAP({ ...imap, username: value });
    if (!smtp.username || smtp.username === email) setSMTP({ ...smtp, username: value });
    setEmail(value);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      await api.addAccount(
        {
          providerCode: provider,
          email,
          displayName: name,
          imap,
          smtp: same ? { ...smtp, username: imap.username, password: imap.password } : smtp,
        },
        controller.signal,
      );
      onSaved();
      onClose();
    } catch (error) {
      if (!controller.signal.aborted) setError(error);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return {
    presets,
    provider,
    email,
    name,
    setName,
    imap,
    setIMAP,
    smtp,
    setSMTP,
    same,
    setSame,
    busy,
    error,
    request,
    errorRef,
    changeProvider,
    changeEmail,
    submit,
  };
}

export function AccountDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('mail');
  const ref = useMailDialog();
  const title = useId();
  const {
    presets,
    provider,
    email,
    name,
    setName,
    imap,
    setIMAP,
    smtp,
    setSMTP,
    same,
    setSame,
    busy,
    error,
    request,
    errorRef,
    changeProvider,
    changeEmail,
    submit,
  } = useAccountForm(onClose, onSaved);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        request.current?.abort();
        onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <header>
          <h2 id={title}>{t('addTitle')}</h2>
          <button type="button" onClick={onClose}>
            {t('close')}
          </button>
        </header>
        <div className={styles.content}>
          <fieldset disabled={busy || presets.length === 0} className={styles.fields}>
            <label>
              {t('provider')}
              <select
                value={provider}
                onChange={(event) => changeProvider(event.currentTarget.value)}
              >
                {presets.map((preset) => (
                  <option key={preset.code} value={preset.code}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('email')}
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(event) => changeEmail(event.currentTarget.value)}
              />
            </label>
            <label>
              {t('displayName')}
              <input
                maxLength={256}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <ServerFields label="IMAP" value={imap} onChange={setIMAP} />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={same}
                onChange={(event) => setSame(event.currentTarget.checked)}
              />
              {t('sameCredentials')}
            </label>
            <ServerFields label="SMTP" value={smtp} onChange={setSMTP} credentials={!same} />
          </fieldset>
          <p className={styles.hint}>{t('accountHint')}</p>
          {provider === 'gmail' && <p className={styles.hint}>{t('googleHint')}</p>}
          {error != null && (
            <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
              {t(api.errorKey(error))}
            </p>
          )}
        </div>
        <footer>
          <span role="status">{busy ? t('verifying') : ''}</span>
          <button type="submit" disabled={busy || presets.length === 0}>
            {t('save')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

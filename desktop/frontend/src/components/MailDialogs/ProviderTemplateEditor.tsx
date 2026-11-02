import { useEffect, useId, useRef, useState } from 'react';
import type { ProviderPreset, AddAccountInput } from '../../lib/bridge/mail';
import { AuthKind, TLSMode } from '../../lib/bridge/mail';
import {
  createCustomProvider,
  customProviderError,
  type CustomProviderInput,
} from '../../lib/bridge/customProviders';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { UiIcon } from '../UiIcon/UiIcon';
import {
  AccountInput,
  AccountValidationSummary,
  ValidatedAccountForm,
} from './AccountFormValidation';
import { ServerFields } from './ServerFields';
import fields from './MailDialogs.module.css';
import styles from './ProviderTemplateEditor.module.css';

type Connection = CustomProviderInput['imap'];
const blank = (port: number): Connection => ({ host: '', port, tlsMode: TLSMode.TLSImplicit });
const connection = (value: Connection): Connection => ({
  host: value.host,
  port: value.port,
  tlsMode: value.tlsMode,
});
const server = (value: Connection): AddAccountInput['imap'] => ({
  ...value,
  username: '',
  password: '',
  authKind: AuthKind.AuthPassword,
});

// 编辑、取消和保存后的选择共用一个请求/退出周期，避免旧回调误改当前账号；
// 服务器字段已拆出复用，此处集中协调模态与一次性提交。
export function ProviderTemplateEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Pick<AddAccountInput, 'imap' | 'smtp'>;
  onClose: () => void;
  onSaved: (preset: ProviderPreset) => void;
}) {
  const { t } = useTranslation('mail');
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController>();
  const saved = useRef<ProviderPreset>();
  const pending = useRef(false);
  const [name, setName] = useState('');
  // 明确投影连接字段，不把带有凭据的账号 ServerInput 存入编辑器状态或提交 DTO。
  const [imap, setIMAP] = useState<Connection>(() =>
    initial ? connection(initial.imap) : blank(993),
  );
  const [smtp, setSMTP] = useState<Connection>(() =>
    initial ? connection(initial.smtp) : blank(465),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof customProviderError>>();
  const exit = useDialogExit(ref, () => {
    onClose();
    if (saved.current) onSaved(saved.current);
  });
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector('input')?.focus();
    return () => {
      request.current?.abort();
      if (dialog?.open) dialog.close();
    };
  }, []);
  const close = () => {
    request.current?.abort();
    exit.close();
  };
  return (
    <DialogFrame
      ref={ref}
      className={styles.dialog}
      closing={exit.closing}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-hint`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id={`${id}-title`}>{t('addCustomProvider')}</h2>
          <p id={`${id}-hint`}>{t('customProviderPrivacy')}</p>
        </div>
        <button type="button" className={styles.close} aria-label={t('close')} onClick={close}>
          <UiIcon name="close" />
        </button>
      </header>
      <ValidatedAccountForm
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending.current) return;
          const controller = new AbortController();
          request.current = controller;
          pending.current = true;
          setBusy(true);
          setError(undefined);
          void createCustomProvider(
            { name, imap: connection(imap), smtp: connection(smtp) },
            controller.signal,
          )
            .then(
              (value) => {
                if (!controller.signal.aborted) {
                  saved.current = value;
                  exit.close();
                }
              },
              (reason: unknown) => {
                if (!controller.signal.aborted) setError(customProviderError(reason));
              },
            )
            .finally(() => {
              pending.current = false;
              if (!controller.signal.aborted) setBusy(false);
            });
        }}
      >
        <div className={styles.body} data-native-scrollbar="">
          <AccountValidationSummary />
          {error && (
            <p role="alert" className={fields.error}>
              {t(error)}
            </p>
          )}
          <fieldset className={fields.fields} disabled={busy}>
            <AccountInput
              label={t('customProviderName')}
              required
              maxLength={64}
              value={name}
              placeholder={t('customProviderNamePlaceholder')}
              autoComplete="off"
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <ServerFields
              label="IMAP"
              value={server(imap)}
              onChange={(value) => setIMAP(connection(value))}
              credentials={false}
            />
            <ServerFields
              label="SMTP"
              value={server(smtp)}
              onChange={(value) => setSMTP(connection(value))}
              credentials={false}
            />
          </fieldset>
          <p className={styles.hint}>{t('customProviderVerificationHint')}</p>
        </div>
        <footer className={styles.actions}>
          <button type="button" data-button-variant="secondary" onClick={close}>
            {t('cancel')}
          </button>
          <button type="submit" disabled={busy}>
            {t(busy ? 'customProviderSaving' : 'saveCustomProvider')}
          </button>
        </footer>
      </ValidatedAccountForm>
    </DialogFrame>
  );
}

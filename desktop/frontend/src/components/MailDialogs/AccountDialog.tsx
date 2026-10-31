import { useEffect, useId, useRef } from 'react';
import * as api from '../../lib/bridge/mail';
import { useTranslation } from '../../lib/i18n/useTranslation';
import type { ServerInput } from '../../../bindings/omnimail/desktop/internal/service/models';
import { UiIcon } from '../UiIcon/UiIcon';
import { DialogFrame } from '../DialogFrame/DialogFrame';
import { useDialogExit } from '../DialogFrame/useDialogExit';
import { getProviderLabel, ProviderSelection } from './ProviderSelection';
import { useAccountForm, type AccountFormState } from './useAccountForm';
import { useMailDialog } from './useMailDialog';
import { useStepIndicator } from './useStepIndicator';
import { BatchAccountFields } from './BatchAccountFields';
import { BatchAccountResults } from './BatchAccountResults';
import { MAX_BATCH_ACCOUNTS } from './accountBatch';
import { accountErrorKey } from './accountErrors';
import {
  AccountInput,
  AccountSelect,
  AccountValidationSummary,
  ValidatedAccountForm,
} from './AccountFormValidation';
import styles from './MailDialogs.module.css';
import wizard from './AccountDialog.module.css';

const ACCOUNT_STEPS = [
  { label: 'providerSelectionStep', hint: 'providerSelectionProgressHint' },
  { label: 'providerSetupStep', hint: 'providerSetupProgressHint' },
  { label: 'providerVerifyStep', hint: 'providerVerifyProgressHint' },
  { label: 'providerSyncStep', hint: 'providerSyncProgressHint' },
] as const;

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

function AccountFields({ form }: { form: Omit<AccountFormState, 'request' | 'errorRef'> }) {
  const { t } = useTranslation('mail');
  if (form.batchMode || form.provider !== 'custom') {
    return (
      <>
        {form.provider === 'custom' && (
          <fieldset
            disabled={form.busy}
            className={styles.fields}
            aria-label={t('batchSharedServers')}
          >
            <ServerFields
              label="IMAP"
              value={form.imap}
              onChange={form.setIMAP}
              credentials={false}
            />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={form.same}
                onChange={(event) => form.setSame(event.currentTarget.checked)}
              />
              {t('batchSameCredentials')}
            </label>
            <ServerFields
              label="SMTP"
              value={form.smtp}
              onChange={form.setSMTP}
              credentials={false}
            />
          </fieldset>
        )}
        <BatchAccountFields form={form} />
      </>
    );
  }
  return (
    <fieldset disabled={form.busy} className={styles.fields}>
      <AccountInput
        label={t('email')}
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        value={form.email}
        onChange={(event) => form.changeEmail(event.currentTarget.value)}
      />
      <AccountInput
        label={t('displayName')}
        maxLength={256}
        value={form.name}
        onChange={(event) => form.setName(event.currentTarget.value)}
      />
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
  const { t, locale } = useTranslation('mail');
  const ref = useMailDialog();
  const title = useId();
  const progressTitle = useId();
  const contentTitle = useId();
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const { request, errorRef, ...form } = useAccountForm(onSaved);
  const exit = useDialogExit(ref, onClose);
  const close = () => {
    request.current?.abort();
    exit.close();
  };
  const selected = form.presets.find((preset) => preset.code === form.provider);
  const step = form.addedAccount || form.batchComplete ? 4 : form.busy ? 3 : selected ? 2 : 1;
  const { trackRef, indicatorRef } = useStepIndicator(step, locale);
  const syncErrorCode = form.addedAccount?.sync.errorCode ?? '';
  // 同步排队的 BUSY 表示已有任务在执行，不能把并发启动误报成同步失败。
  const syncStartFailed = syncErrorCode !== '' && syncErrorCode !== 'BUSY';
  const batchProblem =
    form.batchIssue === 'duplicate'
      ? t('batchDuplicate')
      : form.batchIssue === 'limit'
        ? t('batchLimit', { max: MAX_BATCH_ACCOUNTS })
        : form.batchIssue === 'invalid'
          ? t('error_INVALID_INPUT')
          : form.batch.started && !form.batch.running && form.batchReview > 0
            ? t('batchReviewSummary', {
                added: form.batchAdded,
                failed: form.batchFailed,
                review: form.batchReview,
              })
            : form.batch.started && !form.batch.running && form.batchFailed > 0
              ? t('batchPartialSummary', { added: form.batchAdded, failed: form.batchFailed })
              : '';
  useEffect(() => {
    if (form.provider) ref.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    else stepTitle.current?.focus();
  }, [form.provider, ref]);
  useEffect(() => {
    if (form.busy || form.addedAccount || form.batchComplete) {
      const body = ref.current?.querySelector<HTMLElement>('form > div');
      if (body) body.scrollTop = 0;
      stepTitle.current?.focus();
    }
  }, [form.busy, form.addedAccount, form.batchComplete, ref]);
  useEffect(() => {
    // 四步在紧凑左栏中可能需要滚动，推进时仅让当前步骤可见，不改变右栏焦点。
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    ref.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [step, ref]);
  const previousDraftCount = useRef(form.drafts.length);
  useEffect(() => {
    const changed = previousDraftCount.current !== form.drafts.length;
    previousDraftCount.current = form.drafts.length;
    if (changed && !form.busy) {
      // 旧账号在原位置展开，最后一项可能已折叠，不能再按 DOM 末项聚焦。
      const current =
        ref.current?.querySelector<HTMLInputElement>(
          '[data-account-editor]:not([hidden]) input[type="email"]',
        ) ?? ref.current?.querySelector<HTMLInputElement>('input[type="email"]');
      current?.focus();
    }
  }, [form.drafts.length, form.busy, ref]);
  return (
    <DialogFrame
      ref={ref}
      closing={exit.closing}
      className={`${styles.dialog} ${wizard.dialog}`}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className={wizard.layout}>
        <aside className={wizard.progress} aria-labelledby={progressTitle}>
          <h2 id={title}>{t('addTitle')}</h2>
          <p id={progressTitle} className={wizard['progress-title']}>
            {t('accountSetupProgress')}
          </p>
          <div ref={trackRef} className={wizard['steps-track']}>
            <div
              ref={indicatorRef}
              className={wizard['step-indicator']}
              data-step-indicator=""
              aria-hidden="true"
            />
            <ol className={wizard.steps} aria-labelledby={progressTitle}>
              {ACCOUNT_STEPS.map(({ label, hint }, index) => {
                const complete = step > index + 1;
                return (
                  <li
                    key={label}
                    aria-current={step === index + 1 ? 'step' : undefined}
                    data-state={complete ? 'complete' : step === index + 1 ? 'current' : 'upcoming'}
                  >
                    <span className={wizard['step-number']} aria-hidden="true">
                      {complete ? <UiIcon name="check" size={14} /> : index + 1}
                    </span>
                    <span className={wizard['step-copy']}>
                      <strong>{t(label)}</strong>
                      <span className={wizard['step-description']}>
                        {index === 0 && complete && selected
                          ? t('progressSelectedProvider', {
                              provider: getProviderLabel(selected, t),
                            })
                          : t(hint)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
        <ValidatedAccountForm
          className={wizard.panel}
          aria-labelledby={contentTitle}
          onSubmit={(event) => void form.submit(event)}
        >
          <header className={wizard['panel-header']}>
            <h3 id={contentTitle} ref={stepTitle} tabIndex={-1} className={wizard['step-title']}>
              {form.addedAccount || form.batchComplete
                ? t('providerSyncStep')
                : form.busy
                  ? t('providerVerifyStep')
                  : selected
                    ? t('configureProvider', { provider: getProviderLabel(selected, t) })
                    : t('chooseProviderHeading')}
            </h3>
            <button
              type="button"
              className={wizard.close}
              aria-label={t('close')}
              data-tooltip={t('close')}
              onClick={close}
            >
              <UiIcon name="close" />
            </button>
          </header>
          <div className={`${styles.content} ${wizard.body} ${selected ? '' : wizard.selection}`}>
            <AccountValidationSummary />
            {selected &&
              !form.addedAccount &&
              !form.batchComplete &&
              !form.batch.running &&
              (form.busy || selected.code !== 'gmail') && (
                <p role={form.busy ? 'status' : undefined} className={wizard.description}>
                  {t(
                    form.busy
                      ? 'verifying'
                      : selected.code === 'custom'
                        ? 'providerSetupDescription'
                        : 'presetSetupDescription',
                  )}
                </p>
              )}
            {(form.error != null || batchProblem) && (
              <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
                {form.error != null ? t(accountErrorKey(form.provider, form.error)) : batchProblem}
              </p>
            )}
            {form.batch.running || form.batchComplete ? (
              <BatchAccountResults form={form} />
            ) : form.addedAccount ? (
              <section className={wizard.result} aria-label={t('accountAdded')}>
                <UiIcon name="check" className={wizard['result-icon']} />
                <h4>{t('accountAdded')}</h4>
                <p className={wizard['result-email']}>{form.addedAccount.email}</p>
                {syncStartFailed ? (
                  <>
                    <p>{t('accountSyncStartFailed')}</p>
                    <p role="alert" className={styles.error}>
                      {t(api.errorKey(form.addedAccount.sync.errorCode))}
                    </p>
                  </>
                ) : (
                  <p role="status">{t('accountSyncBackground')}</p>
                )}
              </section>
            ) : selected ? (
              <>
                <AccountFields form={form} />
                {!form.batch.started && (
                  <button
                    type="button"
                    className={`${wizard.secondary} ${wizard['batch-add']}`}
                    disabled={form.busy || form.drafts.length >= MAX_BATCH_ACCOUNTS}
                    data-tooltip={t('batchLimit', { max: MAX_BATCH_ACCOUNTS })}
                    onClick={form.addAccountDraft}
                  >
                    <UiIcon name="addMailbox" size={16} />
                    {t('batchAdd')}
                  </button>
                )}
              </>
            ) : (
              <ProviderSelection
                presets={form.presets}
                status={form.loadStatus}
                email={form.email}
                onEmailChange={form.changeEmail}
                onSelect={form.changeProvider}
                onRetry={() => {
                  stepTitle.current?.focus();
                  form.retryProviders();
                }}
              />
            )}
          </div>
          {selected && (
            <footer>
              {form.addedAccount || form.batchComplete ? (
                <button type="button" className={wizard.finish} onClick={close}>
                  {t('finishAccountSetup')}
                </button>
              ) : (
                <>
                  {form.batchLocked > 0 && !form.busy ? (
                    <button type="button" className={wizard.secondary} onClick={close}>
                      {t('finishAccountSetup')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={wizard.secondary}
                      disabled={form.busy}
                      onClick={form.backToProviders}
                    >
                      {t('backProviders')}
                    </button>
                  )}
                  <div className={wizard['batch-actions']}>
                    {(form.batchMode || selected.code !== 'custom') && (
                      <span className={wizard['batch-pending']}>
                        {t('batchPending', { count: form.drafts.length - form.batchLocked })}
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={
                        form.busy || (form.batch.started && form.batchLocked === form.drafts.length)
                      }
                    >
                      {form.batchMode
                        ? form.batch.started && !form.busy
                          ? t('batchRetry')
                          : t('batchSubmit', { count: form.drafts.length })
                        : t('save')}
                    </button>
                  </div>
                </>
              )}
            </footer>
          )}
        </ValidatedAccountForm>
      </div>
    </DialogFrame>
  );
}

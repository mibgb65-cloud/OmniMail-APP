import { useEffect, useId, useRef } from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { UiIcon } from '../UiIcon/UiIcon';
import { buildBatchRequests, type AccountDraft, type DraftField } from './accountBatch';
import { accountErrorKey } from './accountErrors';
import { isNeteaseProvider } from './providerInput';
import type { AccountFormState } from './useAccountForm';
import { AccountInput } from './AccountFormValidation';
import { ACCOUNT_FIELD_FOCUS, requestAccountFieldFocus } from './accountFieldFocus';
import styles from './MailDialogs.module.css';
import wizard from './AccountDialog.module.css';

type Props = { form: Omit<AccountFormState, 'request' | 'errorRef'> };
type EntryProps = Props & { draft: AccountDraft; index: number };

function BatchAccountSummary({ form, draft, index, editorId }: EntryProps & { editorId: string }) {
  const { t } = useTranslation('mail');
  const prefix = useId();
  const result = form.batch.results[draft.id];
  const added = result?.status === 'added';
  const review = result?.status === 'review';
  const locked = added || review;
  const ready =
    !locked &&
    !buildBatchRequests(
      {
        providerCode: form.provider ?? 'custom',
        email: form.email,
        displayName: form.name,
        imap: form.imap,
        smtp: form.smtp,
      },
      form.same,
      [draft],
      {},
      form.presets,
    ).issue;
  const status = added
    ? 'batchAdded'
    : review
      ? 'batchReview'
      : result?.status === 'failed'
        ? 'batchFailed'
        : ready
          ? 'batchReady'
          : 'batchIncomplete';
  const summary = (
    <>
      <span className={wizard['batch-status-icon']} data-ready={ready || added}>
        {ready || added ? (
          <UiIcon name="check" size={14} />
        ) : review ? (
          <UiIcon name="about" size={14} />
        ) : (
          index + 1
        )}
      </span>
      <span id={`${prefix}-summary`} className={wizard['batch-summary-info']}>
        <strong className={wizard['batch-summary-email']} data-tooltip={draft.email || undefined}>
          {added
            ? result.account.email
            : draft.email || t('batchEmptyAccount', { index: index + 1 })}
        </strong>
        {draft.name && (
          <span className={wizard['batch-name-badge']} data-tooltip={draft.name}>
            {draft.name}
          </span>
        )}
      </span>
      <span id={`${prefix}-status`} className={wizard['batch-summary-status']} data-state={status}>
        {t(status)}
        {!locked && !ready && (
          <span className={wizard['batch-edit-action']} aria-hidden="true">
            {t('batchEditAction')}
          </span>
        )}
      </span>
    </>
  );
  return (
    <div className={wizard['batch-summary-row']}>
      {locked ? (
        <div className={wizard['batch-summary-main']}>{summary}</div>
      ) : (
        <button
          type="button"
          className={wizard['batch-summary-main']}
          onClick={() => {
            const control = document
              .getElementById(editorId)
              ?.querySelector<HTMLInputElement>('input[type="email"]');
            if (control) requestAccountFieldFocus(control.id);
          }}
          aria-label={t('batchEdit', { index: index + 1 })}
          aria-describedby={`${prefix}-summary ${prefix}-status`}
          aria-expanded={false}
          aria-controls={editorId}
        >
          {summary}
        </button>
      )}
    </div>
  );
}

function BatchAccountCredentials({ form, draft, index }: EntryProps) {
  const { t } = useTranslation('mail');
  const custom = form.provider === 'custom';
  const field = (
    key: DraftField,
    label: string,
    type = 'text',
    maxLength = 320,
    required = true,
  ) => (
    <AccountInput
      label={label}
      scopeLabel={t('batchAccountLabel', { index: index + 1 })}
      type={type}
      required={required}
      maxLength={maxLength}
      value={draft[key]}
      placeholder={
        key === 'email'
          ? t('emailPlaceholder')
          : key === 'name'
            ? t('batchNamePlaceholder')
            : undefined
      }
      autoComplete={
        type === 'password' || key === 'username' || key === 'smtpUsername'
          ? `section-batch-${draft.id}-${key.startsWith('smtp') ? 'smtp' : 'imap'} ${type === 'password' ? 'current-password' : 'username'}`
          : key === 'email'
            ? `section-batch-${draft.id} email`
            : 'off'
      }
      onChange={(event) => form.changeDraft(draft.id, key, event.currentTarget.value)}
    />
  );
  return (
    <div
      className={`${styles.fields} ${wizard['batch-credentials']} ${custom ? wizard['batch-custom-credentials'] : ''}`}
    >
      {field('email', t('email'), 'email', 254)}
      {field('name', t('displayName'), 'text', 256, false)}
      {custom && field('username', t('batchIncomingUsername'))}
      {field(
        'password',
        t(
          custom ? 'batchIncomingPassword' : form.provider === 'gmail' ? 'appPassword' : 'password',
        ),
        'password',
        1024,
      )}
      {custom && !form.same && (
        <>
          {field('smtpUsername', t('batchOutgoingUsername'))}
          {field('smtpPassword', t('batchOutgoingPassword'), 'password', 1024)}
        </>
      )}
    </div>
  );
}

export function BatchAccountFields({ form }: Props) {
  const { t } = useTranslation('mail');
  const prefix = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const editAccountDraft = form.editAccountDraft;
  const entries = form.drafts.map((draft, index) => ({ draft, index }));
  const editable = entries.filter(
    ({ draft }) => !['added', 'review'].includes(form.batch.results[draft.id]?.status ?? ''),
  );
  const active = editable.find(({ draft }) => draft.id === form.editingDraftId) ?? editable[0];
  const providerHint =
    form.provider === 'gmail'
      ? 'googleHint'
      : form.provider === 'linuxdo'
        ? 'linuxdoHint'
        : isNeteaseProvider(form.provider)
          ? 'neteaseHint'
          : undefined;
  // 始终按草稿顺序原位展开，既不改变请求顺序，也不因编辑切换打乱键盘导航。
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reveal = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const row = event.target.closest('[data-account-id]');
      if (row) editAccountDraft(Number(row.getAttribute('data-account-id')));
    };
    root.addEventListener(ACCOUNT_FIELD_FOCUS, reveal);
    return () => root.removeEventListener(ACCOUNT_FIELD_FOCUS, reveal);
  }, [editAccountDraft]);
  return (
    <div ref={rootRef} className={wizard['batch-fields']}>
      {providerHint ? (
        <div className={wizard['batch-notice']}>
          <UiIcon name="about" size={16} />
          <p>{t(providerHint)}</p>
        </div>
      ) : (
        <p className={styles.hint}>{t('batchSameProviderHint')}</p>
      )}
      {entries.map(({ draft, index }) => {
        const result = form.batch.results[draft.id];
        const added = result?.status === 'added';
        const review = result?.status === 'review';
        const failed = result?.status === 'failed';
        const errorId = `${prefix}-${draft.id}-error`;
        const editorId = `${prefix}-${draft.id}-editor`;
        const editing = active?.draft.id === draft.id;
        const locked = added || review;
        return (
          <fieldset
            key={draft.id}
            disabled={form.busy}
            className={wizard['batch-account']}
            data-account-id={draft.id}
            data-editing={editing}
            aria-label={t('batchAccountLabel', { index: index + 1 })}
            aria-describedby={failed ? errorId : undefined}
          >
            <legend className={wizard['batch-legend']}>
              {t('batchAccountLabel', { index: index + 1 })}
            </legend>
            {editing ? (
              <div className={wizard['batch-editor-header']}>
                <span className={wizard['batch-editor-badge']}>
                  {t('batchEditing', { index: index + 1 })}
                </span>
                {form.drafts.length > 1 && (
                  <span className={wizard['batch-editor-hint']}>{t('batchSwitchHint')}</span>
                )}
                {form.drafts.length > 1 && !form.batch.started && (
                  <button
                    type="button"
                    className={wizard['batch-editor-remove']}
                    aria-label={t('batchRemove', { index: index + 1 })}
                    onClick={() => form.removeAccountDraft(draft.id)}
                  >
                    {t('batchRemoveCurrent')}
                  </button>
                )}
              </div>
            ) : (
              <BatchAccountSummary form={form} draft={draft} index={index} editorId={editorId} />
            )}
            {!editing && form.drafts.length > 1 && !form.batch.started && (
              <button
                type="button"
                className={wizard['batch-remove']}
                aria-label={t('batchRemove', { index: index + 1 })}
                data-tooltip={t('batchRemove', { index: index + 1 })}
                onClick={() => form.removeAccountDraft(draft.id)}
              >
                <UiIcon name="close" size={14} />
              </button>
            )}
            {locked ? (
              <div className={wizard['batch-added']}>
                <span>{t(review ? 'batchReviewLocked' : 'batchAddedLocked')}</span>
              </div>
            ) : (
              <div
                id={editorId}
                data-account-editor=""
                hidden={!editing}
                className={wizard['batch-editor-content']}
              >
                <BatchAccountCredentials form={form} draft={draft} index={index} />
                {failed && (
                  <p id={errorId} className={styles.error}>
                    {t(accountErrorKey(form.provider, result.errorCode))}
                  </p>
                )}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

import type { AccountSummary } from '../../lib/bridge/mail';
import { todoStatuses, type TodoEdit } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './Tasks.module.css';

export function TodoEditFields({
  input,
  onChange,
  accounts,
  disabled,
}: {
  input: TodoEdit;
  onChange: (value: TodoEdit) => void;
  accounts: AccountSummary[];
  disabled: boolean;
}) {
  const { t } = useTranslation('tasks');
  return (
    <fieldset className={`${styles.fieldset} ${styles.stack}`} disabled={disabled}>
      <label className={styles.field}>
        {t('titleField')}
        <input
          required
          maxLength={1000}
          value={input.title}
          onChange={(event) => onChange({ ...input, title: event.target.value })}
        />
      </label>
      <fieldset className={styles.fieldset}>
        <legend>{t('status')}</legend>
        <div className={styles.filters}>
          {todoStatuses.map((status) => (
            <label className={`${styles.check} ${styles.option}`} key={status}>
              <input
                type="radio"
                name="todo-status"
                value={status}
                checked={input.status === status}
                onChange={() => onChange({ ...input, status })}
              />
              {t(`status_${status}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          {t('owner')}
          <input
            maxLength={200}
            value={input.owner}
            onChange={(event) => onChange({ ...input, owner: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          {t('due')}
          <input
            maxLength={100}
            value={input.due}
            onChange={(event) => onChange({ ...input, due: event.target.value })}
          />
        </label>
      </div>
      <p className={styles.hint}>{t('dueHint')}</p>
      <label className={styles.field}>
        {t('notes')}
        <textarea
          maxLength={4096}
          value={input.notes}
          onChange={(event) => onChange({ ...input, notes: event.target.value })}
        />
      </label>
      <label className={styles.field}>
        {t('account')}
        <select
          value={input.accountId}
          disabled={!!input.id}
          onChange={(event) => onChange({ ...input, accountId: event.target.value })}
        >
          <option value="">{t('noAccount')}</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName || account.email}
            </option>
          ))}
          {input.accountId && !accounts.some((account) => account.id === input.accountId) && (
            <option value={input.accountId}>{t('removedAccount')}</option>
          )}
        </select>
      </label>
    </fieldset>
  );
}

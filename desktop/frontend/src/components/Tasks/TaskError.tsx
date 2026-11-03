import { aiErrorKey } from '../../lib/bridge/ai';
import { isTaskErrorCode, taskErrorKey } from '../../lib/bridge/tasks';
import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './Tasks.module.css';

export function TaskError({ error }: { error: unknown }) {
  const { t } = useTranslation('tasks');
  const { t: ai } = useTranslation('ai');
  const key = taskErrorKey(error);
  return (
    <p className={styles.error} role="alert">
      {isTaskErrorCode(key) ? t(key) : ai(aiErrorKey(error))}
    </p>
  );
}

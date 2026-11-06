import { useState } from 'react';
import type { MailDetail } from '../../lib/bridge/mail';
import { aiErrorKey } from '../../lib/bridge/ai';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { useMailAI } from './useMailAI';
import styles from './MailAI.module.css';

export function MailAIPanel({
  detail,
  selectedId,
  suspended = false,
  onAdopt,
  hasDraft = false,
  hasSender = false,
}: {
  detail?: MailDetail;
  selectedId: string;
  suspended?: boolean;
  onAdopt?: (body: string) => boolean;
  hasDraft?: boolean;
  hasSender?: boolean;
}) {
  const { t } = useTranslation('ai');
  const ai = useMailAI(detail, selectedId, suspended);
  const result = ai.analysis;
  const [intent, setIntent] = useState('');
  const [adoption, setAdoption] = useState<'adopted' | 'existingDraft'>();
  const [tone, setTone] = useState<'neutral' | 'friendly' | 'formal'>('neutral');
  const ready = !!ai.config?.endpoint && ai.config.consent;
  const cooldown = ai.progress?.retrySeconds ?? 0;
  const disabled = !ready || !ai.available || ai.busy || cooldown > 0;
  return (
    <div className={styles.content}>
      {!ready && <p className={styles.hint}>{t('configure')}</p>}
      {!ai.available && <p className={styles.hint}>{t('selectMail')}</p>}
      {ai.config?.endpoint && (
        <p className={styles.hint}>
          {ai.config.model} · {ai.config.endpoint}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => ai.run('analysis', '', '', !!result)}
        >
          {t(result ? 'regenerate' : 'analyze')}
        </button>
        {ai.busy && (
          <button type="button" onClick={ai.cancel}>
            {t('cancel')}
          </button>
        )}
      </div>
      {ai.busy && <p role="status">{t(ai.progress?.stage ?? 'preparing')}</p>}
      {ai.error != null && (
        <p className={styles.error} role="alert">
          {t(aiErrorKey(ai.error))}
        </p>
      )}
      {cooldown > 0 && <p role="status">{t('cooldown', { seconds: cooldown })}</p>}
      {result && (
        <section className={styles.result} aria-label={t('summary')}>
          <h3>{t('summary')}</h3>
          {result.cached && <p className={styles.hint}>{t('cached')}</p>}
          <p>{result.summary}</p>
          <h4>{t('points')}</h4>
          <ul>
            {result.points.map((point, index) => (
              <li key={`${index}:${point}`}>{point}</li>
            ))}
          </ul>
          <h4>{t('tasks')}</h4>
          {!result.tasks.length && <p className={styles.hint}>{t('noTasks')}</p>}
          <ul>
            {result.tasks.map((task, index) => (
              <li key={`${index}:${task.text}`}>
                <p>{task.text}</p>
                <p className={styles.hint}>
                  {t('owner')}：{task.owner || t('unknown')} · {t('due')}：
                  {task.due || t('unknown')}
                </p>
                <blockquote className={styles.evidence} aria-label={t('evidence')}>
                  {task.evidence}
                </blockquote>
              </li>
            ))}
          </ul>
          <h4>{t('facts')}</h4>
          {!result.facts.length && <p className={styles.hint}>{t('noFacts')}</p>}
          <ul>
            {result.facts.map((fact, index) => (
              <li key={`${index}:${fact.text}`}>
                <p>{fact.text}</p>
                <blockquote className={styles.evidence} aria-label={t('evidence')}>
                  {fact.evidence}
                </blockquote>
              </li>
            ))}
          </ul>
          {result.warning && <p role="status">{t('cacheWarning')}</p>}
        </section>
      )}
      <section className={styles.result} aria-label={t('replyTitle')}>
        <h3>{t('replyTitle')}</h3>
        <label className={styles.field}>
          {t('intent')}
          <textarea
            value={intent}
            maxLength={2000}
            disabled={ai.busy}
            onChange={(event) => setIntent(event.target.value)}
          />
        </label>
        <p className={styles.hint}>{t('intentHint')}</p>
        <label className={styles.field}>
          {t('tone')}
          <select
            value={tone}
            disabled={ai.busy}
            onChange={(event) => {
              if (
                event.target.value === 'neutral' ||
                event.target.value === 'friendly' ||
                event.target.value === 'formal'
              )
                setTone(event.target.value);
            }}
          >
            <option value="neutral">{t('neutral')}</option>
            <option value="friendly">{t('friendly')}</option>
            <option value="formal">{t('formal')}</option>
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || !intent.trim() || new TextEncoder().encode(intent).length > 2000}
          onClick={() => ai.run('reply', intent, tone)}
        >
          {t('generateReply')}
        </button>
        {ai.reply && (
          <>
            <p className={styles.reply}>{ai.reply.reply}</p>
            {ai.reply.warning && <p role="status">{t('cacheWarning')}</p>}
            <p className={styles.hint}>{t('adoptHint')}</p>
            {hasDraft && <p className={styles.hint}>{t('existingDraft')}</p>}
            {!hasSender && <p className={styles.hint}>{t('noSender')}</p>}
            <button
              type="button"
              disabled={
                ai.busy ||
                hasDraft ||
                !hasSender ||
                !onAdopt ||
                ai.replyRequest?.intent !== intent ||
                ai.replyRequest?.tone !== tone
              }
              onClick={() => {
                if (ai.reply && onAdopt)
                  setAdoption(onAdopt(ai.reply.reply) ? 'adopted' : 'existingDraft');
              }}
            >
              {t('adopt')}
            </button>
            {adoption && <p role="status">{t(adoption)}</p>}
          </>
        )}
      </section>
      <p className={styles.hint}>{t('machine')}</p>
    </div>
  );
}

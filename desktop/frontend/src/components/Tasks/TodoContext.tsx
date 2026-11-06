import type { TodoDetails, TodoEdit, SourceView } from '../../lib/bridge/taskModels';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { TaskError } from './TaskError';
import styles from './Tasks.module.css';

export function TodoContext({
  details,
  input,
  dirty,
  busy,
  source,
  onResolve,
  onSource,
}: {
  details: TodoDetails;
  input: TodoEdit;
  dirty: boolean;
  busy: boolean;
  source?: SourceView;
  onResolve: (id: string, accept: boolean) => void;
  onSource: (id: string) => void;
}) {
  const { t } = useTranslation('tasks');
  return (
    <div className={styles.stack}>
      <section className={styles.stack}>
        <h3 className={styles.contextHeading}>
          {t('proposals')}
          <span className={styles.statusBadge}>{details.proposals.length}</span>
        </h3>
        <p className={styles.hint}>{t('proposalHint')}</p>
        {dirty && <p className={styles.hint}>{t('saveFirst')}</p>}
        {!details.proposals.length && <p className={styles.hint}>{t('noProposals')}</p>}
        {details.proposals.map((proposal) => (
          <section className={`${styles.card} ${styles.stack}`} key={proposal.id}>
            <strong>{t(`proposal_${proposal.kind}`)}</strong>
            <p>{proposal.reason}</p>
            <dl className={styles.delta}>
              <dt>{t('beforeValue')}</dt>
              <dd>
                {input.title}
                <small className={styles.hint}>
                  {' '}
                  · {input.owner} · {input.due}
                </small>
              </dd>
              <dt>{t('afterValue')}</dt>
              <dd>
                {proposal.title}
                <small className={styles.hint}>
                  {' '}
                  · {proposal.owner || t('keep')} · {proposal.due || t('keep')}
                </small>
              </dd>
            </dl>
            <blockquote className={styles.quote}>{proposal.evidence}</blockquote>
            <div className={styles.actions}>
              <button
                type="button"
                data-button-variant="secondary"
                disabled={dirty || busy}
                onClick={() => onResolve(proposal.id, true)}
              >
                {t('apply')}
              </button>
              <button
                type="button"
                data-button-variant="ghost"
                disabled={dirty || busy}
                onClick={() => onResolve(proposal.id, false)}
              >
                {t('ignore')}
              </button>
            </div>
          </section>
        ))}
      </section>
      <section className={styles.stack}>
        <h3 className={styles.contextHeading}>
          {t('evidence')}
          <span className={styles.statusBadge}>{details.sources.length}</span>
        </h3>
        {!details.sources.length && <p className={styles.hint}>{t('noSources')}</p>}
        {details.sources.map((entry) => (
          <section className={`${styles.card} ${styles.stack}`} key={entry.id}>
            <strong>{entry.subject}</strong>
            <blockquote className={styles.quote}>{entry.evidence}</blockquote>
            {entry.available ? (
              <button
                type="button"
                data-button-variant="ghost"
                disabled={busy}
                onClick={() => onSource(entry.id)}
              >
                {t('viewSource')}
              </button>
            ) : (
              <p className={styles.hint}>{t('sourceGone')}</p>
            )}
          </section>
        ))}
        {details.truncated && <p className={styles.hint}>{t('truncated')}</p>}
        {source && (
          <section className={styles.stack} aria-label={t('sourcePreview')}>
            <strong>{source.source.subject}</strong>
            {!source.source.available && <p className={styles.hint}>{t('sourceGone')}</p>}
            {source.changed && <p className={styles.hint}>{t('sourceChanged')}</p>}
            {source.error && <TaskError error={new Error(source.error)} />}
            <pre className={styles.bodytext}>{source.body}</pre>
          </section>
        )}
      </section>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  aiConfig,
  aiErrorKey,
  saveAIConfig,
  testAIConnection,
  clearAICaches,
  type AIConfig,
  type AIConfigInput,
} from '../../lib/bridge/ai';
import { useTranslation } from '../../lib/i18n/useTranslation';
import styles from './MailAI.module.css';
import { aiInputFromConfig, fillDeepSeekInput } from './aiPresets';

export function AISettings() {
  const { t } = useTranslation('ai');
  const [config, setConfig] = useState<AIConfig>();
  const [input, setInput] = useState<AIConfigInput>({
    endpoint: '',
    model: '',
    language: 'zh',
    consent: false,
    apiKey: '',
    removeKey: false,
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'testing' | 'clearing'>(
    'loading',
  );
  const [feedback, setFeedback] = useState<'saved' | 'tested' | 'cleared'>();
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const request = useRef<AbortController>();
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void aiConfig(controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setConfig(value);
        setInput(aiInputFromConfig(value));
        setStatus('ready');
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason);
          setStatus('ready');
        }
      },
    );
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [attempt]);
  const dirty =
    !!config &&
    (input.endpoint !== config.endpoint ||
      input.model !== config.model ||
      input.language !== config.language ||
      input.consent !== config.consent ||
      !!input.apiKey ||
      input.removeKey);
  const run = async (test: boolean) => {
    if (pending.current || !config || status !== 'ready') return;
    pending.current = true;
    const controller = new AbortController();
    request.current = controller;
    setStatus(test ? 'testing' : 'saving');
    setError(undefined);
    setFeedback(undefined);
    try {
      if (test) await testAIConnection(controller.signal);
      else {
        const saved = await saveAIConfig(input, controller.signal);
        if (!controller.signal.aborted) {
          setConfig(saved);
          setInput(aiInputFromConfig(saved));
        }
      }
      if (!controller.signal.aborted) setFeedback(test ? 'tested' : 'saved');
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason);
        if (!test) setConfig(undefined);
      }
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setStatus('ready');
    }
  };
  return (
    <section className={styles.content} aria-label={t('settings')}>
      <p className={styles.hint}>{t('description')}</p>
      {status !== 'ready' && <p role="status">{t(status)}</p>}
      {error != null && (
        <p className={styles.error} role="alert">
          {t(aiErrorKey(error))}
        </p>
      )}
      {!config && status === 'ready' && (
        <button
          type="button"
          onClick={() => {
            setError(undefined);
            setStatus('loading');
            setAttempt((v) => v + 1);
          }}
        >
          {t('retry')}
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(false);
        }}
      >
        <fieldset className={styles.form} disabled={!config || status !== 'ready'}>
          <div className={styles.actions}>
            <button
              type="button"
              data-button-variant="secondary"
              onClick={() => {
                setInput((current) => fillDeepSeekInput(current));
                setFeedback(undefined);
              }}
            >
              {t('deepseekPreset')}
            </button>
          </div>
          <p className={styles.hint}>{t('deepseekHint')}</p>
          <label className={styles.field}>
            {t('endpoint')}
            <input
              value={input.endpoint}
              maxLength={2048}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setInput({ ...input, endpoint: event.target.value, consent: false });
                setFeedback(undefined);
              }}
            />
          </label>
          <p className={styles.hint}>{t('endpointHint')}</p>
          <label className={styles.field}>
            {t('model')}
            <input
              value={input.model}
              maxLength={128}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setInput({ ...input, model: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            {t('language')}
            <select
              value={input.language}
              onChange={(event) => {
                if (event.target.value === 'zh' || event.target.value === 'en')
                  setInput({ ...input, language: event.target.value });
              }}
            >
              <option value="zh">{t('zh')}</option>
              <option value="en">{t('en')}</option>
            </select>
          </label>
          <label className={styles.field}>
            {t('key')}
            <input
              type="password"
              autoComplete="new-password"
              maxLength={2048}
              value={input.apiKey}
              disabled={input.removeKey}
              onChange={(event) => setInput({ ...input, apiKey: event.target.value })}
            />
          </label>
          <p className={styles.hint}>{t(config?.hasKey ? 'keyStored' : 'keyEmpty')}</p>
          {config?.hasKey && (
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={input.removeKey}
                onChange={(event) =>
                  setInput({ ...input, apiKey: '', removeKey: event.target.checked })
                }
              />
              {t('removeKey')}
            </label>
          )}
          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={input.consent}
              disabled={!input.endpoint}
              onChange={(event) => setInput({ ...input, consent: event.target.checked })}
            />
            <span>{t('privacy', { endpoint: input.endpoint || '—' })}</span>
          </label>
          <p className={styles.hint}>{t('privacyHint')}</p>
          <div className={styles.actions}>
            <button type="submit">{t('save')}</button>
            <button
              type="button"
              disabled={dirty || !config?.endpoint}
              onClick={() => void run(true)}
            >
              {t('test')}
            </button>
          </div>
          <p className={styles.hint}>{t('testHint')}</p>
        </fieldset>
      </form>
      <div className={styles.result}>
        <p className={styles.hint}>{t('clearHint')}</p>
        <button
          type="button"
          disabled={status !== 'ready'}
          onClick={async () => {
            if (!confirmClear) {
              setConfirmClear(true);
              return;
            }
            if (pending.current) return;
            pending.current = true;
            const controller = new AbortController();
            request.current = controller;
            setStatus('clearing');
            setError(undefined);
            setFeedback(undefined);
            try {
              await clearAICaches(controller.signal);
              if (!controller.signal.aborted) {
                setFeedback('cleared');
                setConfirmClear(false);
              }
            } catch (reason) {
              if (!controller.signal.aborted) setError(reason);
            } finally {
              pending.current = false;
              if (!controller.signal.aborted) setStatus('ready');
            }
          }}
        >
          {t(confirmClear ? 'confirmClear' : 'clearCache')}
        </button>
      </div>
      {feedback && <p role="status">{t(feedback)}</p>}
    </section>
  );
}

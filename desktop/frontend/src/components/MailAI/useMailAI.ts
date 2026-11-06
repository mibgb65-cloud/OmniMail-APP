import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  aiConfig,
  aiProgress,
  aiRevision,
  cachedMailAI,
  runMailAI,
  subscribeAI,
  type AIConfig,
} from '../../lib/bridge/ai';
import type { AIRequest, AIResult } from '../../lib/bridge/aiResult';
import type { MailDetail } from '../../lib/bridge/mail';

type Progress = Awaited<ReturnType<typeof aiProgress>>;
interface Snapshot {
  source: MailDetail;
  revision: number;
  jobEpoch?: number;
  status: 'idle' | 'loading' | 'error' | 'success';
  analysis?: AIResult;
  reply?: AIResult;
  replyRequest?: { intent: string; tone: AIRequest['tone'] };
  error?: unknown;
  progress?: Progress;
}

export function useMailAI(detail: MailDetail | undefined, selectedId: string, suspended: boolean) {
  const revision = useSyncExternalStore(subscribeAI, aiRevision);
  const [configuration, setConfiguration] = useState<{
    revision: number;
    value?: AIConfig;
    error?: unknown;
  }>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const epoch = useRef(0);
  const request = useRef<{
    source: MailDetail;
    revision: number;
    controller: AbortController;
    epoch: number;
    selectedId: string;
    suspended: boolean;
  }>();
  const current = useRef({ detail, selectedId, suspended, revision });
  useLayoutEffect(() => {
    current.current = { detail, selectedId, suspended, revision };
  }, [detail, selectedId, suspended, revision]);
  const matches = useCallback(
    (source: MailDetail, version: number) =>
      current.current.detail === source &&
      current.current.selectedId === source.id &&
      !current.current.suspended &&
      current.current.revision === version,
    [],
  );
  const available =
    !!detail &&
    detail.id === selectedId &&
    detail.cached &&
    (detail.bodyVersion ?? 0) >= 1 &&
    !detail.bodyErrorCode &&
    !suspended;
  useEffect(() => {
    const controller = new AbortController();
    const source = available ? detail : undefined;
    const action = epoch.current;
    void aiConfig(controller.signal)
      .then(async (value) => {
        if (controller.signal.aborted || current.current.revision !== revision) return;
        setConfiguration({ revision, value });
        if (source && value.endpoint) {
          const result = await cachedMailAI(source.id, controller.signal);
          if (
            result &&
            result.accountId === source.accountId &&
            result.revision === value.revision &&
            !controller.signal.aborted &&
            action === epoch.current &&
            matches(source, revision)
          ) {
            setSnapshot({ source, revision, status: 'success', analysis: result });
          }
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (source && matches(source, revision) && action === epoch.current) {
          setSnapshot({ source, revision, status: 'error', error });
        } else if (!source) setConfiguration({ revision, error });
        else
          setConfiguration((previous) =>
            previous?.revision === revision && previous.value ? previous : { revision, error },
          );
      });
    return () => {
      controller.abort();
      const job = request.current;
      if (
        job &&
        job.source === detail &&
        job.revision === revision &&
        job.selectedId === selectedId &&
        job.suspended === suspended
      ) {
        job.controller.abort();
        request.current = undefined;
        setSnapshot((old) =>
          old?.jobEpoch === job.epoch ? { ...old, status: 'idle', progress: undefined } : old,
        );
      }
    };
  }, [detail, selectedId, suspended, available, revision, matches]);
  const state =
    snapshot && snapshot.source === detail && snapshot.revision === revision && available
      ? snapshot
      : undefined;
  const config = configuration?.revision === revision ? configuration.value : undefined;
  const busy = state?.status === 'loading';
  const run = (
    action: AIRequest['action'],
    intent = '',
    tone: AIRequest['tone'] = '',
    regenerate = false,
  ) => {
    if (!available || !detail || !config || request.current) return;
    const source = detail,
      controller = new AbortController();
    const job = { source, revision, controller, epoch: ++epoch.current, selectedId, suspended };
    request.current = job;
    setSnapshot({
      ...state,
      source,
      revision,
      jobEpoch: job.epoch,
      status: 'loading',
      error: undefined,
      progress: { stage: 'preparing', retrySeconds: 0 },
    });
    void runMailAI({ mailId: source.id, action, intent, tone, regenerate }, controller.signal)
      .then((result) => {
        if (result.revision !== config.revision || result.accountId !== source.accountId)
          throw new Error('AI_INVALID_RESPONSE');
        if (!controller.signal.aborted && matches(source, revision)) {
          setSnapshot((old) => ({
            ...old,
            source,
            revision,
            status: 'success',
            error: undefined,
            progress: { stage: 'idle', retrySeconds: 0 },
            [action === 'analysis' ? 'analysis' : 'reply']: result,
            replyRequest: action === 'reply' ? { intent, tone } : old?.replyRequest,
          }));
        }
      })
      .catch(async (error: unknown) => {
        if (controller.signal.aborted || !matches(source, revision)) return;
        setSnapshot((old) => ({ ...old, source, revision, status: 'error', error }));
        try {
          const progress = await aiProgress(source.id, controller.signal);
          if (!controller.signal.aborted && matches(source, revision))
            setSnapshot((old) => old && { ...old, progress });
        } catch (progressError) {
          if (!controller.signal.aborted && matches(source, revision))
            setSnapshot((old) => old && { ...old, error: old.error ?? progressError });
        }
      })
      .finally(() => {
        if (request.current === job) request.current = undefined;
      });
  };
  const polling = busy || (state?.progress?.retrySeconds ?? 0) > 0;
  useEffect(() => {
    if (!polling || !detail) return;
    const source = detail,
      controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const progress = await aiProgress(source.id, controller.signal);
        if (!controller.signal.aborted && matches(source, revision)) {
          setSnapshot((old) => old && { ...old, progress });
          timer = setTimeout(() => void poll(), 1000);
        }
      } catch (error) {
        if (!controller.signal.aborted && matches(source, revision))
          setSnapshot((old) => old && { ...old, error: old.error ?? error });
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [polling, detail, revision, matches]);
  return {
    available,
    config,
    busy,
    analysis: state?.analysis,
    reply: state?.reply,
    replyRequest: state?.replyRequest,
    progress: state?.progress,
    error: state?.error ?? (configuration?.revision === revision ? configuration.error : undefined),
    run,
    cancel: () => {
      epoch.current++;
      request.current?.controller.abort();
      request.current = undefined;
      if (detail)
        setSnapshot({
          ...state,
          source: detail,
          revision,
          status: 'idle',
          error: new Error('AI_CANCELED'),
        });
    },
  };
}

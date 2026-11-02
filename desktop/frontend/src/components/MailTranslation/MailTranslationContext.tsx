import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MailDetail } from '../../lib/bridge/mail';
import {
  translateMail,
  cachedTranslation,
  type TranslationLanguage,
  type TranslationResult,
} from '../../lib/bridge/translation';
import { MailTranslationDialog } from './MailTranslationDialog';

interface Controller {
  available: boolean;
  busy: boolean;
  open: () => void;
  cancel: () => void;
  error?: unknown;
  result?: TranslationResult;
  source?: MailDetail;
  show: boolean;
  setShow: (value: boolean) => void;
}
const Context = createContext<Controller | undefined>(undefined);
export const useMailTranslation = () => useContext(Context);

// 选中快照、请求与确认窗共用生命周期，集中协调取消/换邮件竞态；
// HTTP、偏好与展示分别在桥接和子组件中，避免把旧结果挂到新邮件。
export function MailTranslationProvider({
  detail,
  selectedId,
  suspended = false,
  children,
}: {
  detail?: MailDetail;
  selectedId: string;
  suspended?: boolean;
  children: ReactNode;
}) {
  const request = useRef<AbortController>();
  const actionEpoch = useRef(0);
  const requestScope = useRef<{ detail: MailDetail; selectedId: string; suspended: boolean }>();
  const current = useRef({ detail, selectedId, suspended });
  useLayoutEffect(() => {
    current.current = { detail, selectedId, suspended };
  }, [detail, selectedId, suspended]);
  const [dialog, setDialog] = useState<MailDetail>();
  const [busy, setBusy] = useState(false);
  const [jobSource, setJobSource] = useState<MailDetail>();
  const [snapshot, setSnapshot] = useState<{ source: MailDetail; result: TranslationResult }>();
  const [error, setError] = useState<{ source: MailDetail; error: unknown }>();
  const [show, setShow] = useState(true);
  const available =
    !!detail &&
    detail.id === selectedId &&
    detail.cached &&
    (detail.bodyVersion ?? 0) >= 1 &&
    !detail.bodyErrorCode &&
    !suspended;
  useEffect(() => {
    const controller = new AbortController();
    const epoch = actionEpoch.current;
    if (available && detail) {
      const source = detail;
      void cachedTranslation(source.id, controller.signal).then(
        (result) => {
          if (
            result &&
            result.mailId === source.id &&
            !controller.signal.aborted &&
            epoch === actionEpoch.current &&
            current.current.detail === source &&
            current.current.selectedId === source.id &&
            !current.current.suspended
          ) {
            setSnapshot({ source, result });
            setShow(false);
          }
        },
        (reason) => {
          if (
            !controller.signal.aborted &&
            epoch === actionEpoch.current &&
            current.current.detail === source
          )
            setError({ source, error: reason });
        },
      );
    }
    return () => {
      controller.abort();
      const scope = requestScope.current;
      if (
        scope &&
        scope.detail === detail &&
        scope.selectedId === selectedId &&
        scope.suspended === suspended
      )
        request.current?.abort();
    };
  }, [detail, selectedId, suspended, available]);
  const valid =
    !!snapshot && !!detail && snapshot.source === detail && detail.id === selectedId && !suspended;
  const start = (target: TranslationLanguage) => {
    if (!available || !detail) return;
    request.current?.abort();
    actionEpoch.current++;
    const controller = new AbortController();
    request.current = controller;
    requestScope.current = { detail, selectedId, suspended };
    const source = detail;
    setJobSource(source);
    setDialog(undefined);
    setBusy(true);
    setError(undefined);
    void translateMail(source.id, target, controller.signal)
      .then(
        (result) => {
          if (
            !controller.signal.aborted &&
            current.current.detail === source &&
            current.current.selectedId === source.id &&
            !current.current.suspended
          ) {
            setSnapshot({ source, result });
            setShow(true);
          }
        },
        (reason: unknown) => {
          if (!controller.signal.aborted && current.current.detail === source)
            setError({ source, error: reason });
        },
      )
      .finally(() => {
        if (request.current === controller) {
          request.current = undefined;
          setBusy(false);
        }
      });
  };
  const cancel = () => {
    actionEpoch.current++;
    request.current?.abort();
    request.current = undefined;
    setBusy(false);
  };
  return (
    <Context.Provider
      value={{
        available,
        busy: busy && jobSource === detail && detail?.id === selectedId && !suspended,
        error:
          error?.source === detail && detail?.id === selectedId && !suspended
            ? error?.error
            : undefined,
        source: valid ? detail : undefined,
        result: valid ? snapshot.result : undefined,
        show: valid && show,
        setShow: (value) => {
          actionEpoch.current++;
          setShow(value);
        },
        open: () => {
          if (available && detail) setDialog(detail);
          actionEpoch.current++;
        },
        cancel,
      }}
    >
      {children}
      {dialog && dialog === detail && available && (
        <MailTranslationDialog onClose={() => setDialog(undefined)} onTranslate={start} />
      )}
    </Context.Provider>
  );
}

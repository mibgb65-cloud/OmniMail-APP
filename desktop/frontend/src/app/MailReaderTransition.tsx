import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MailDetail } from '../lib/bridge/mail';
import * as api from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { MailSkeleton } from './MailSkeleton';
import { MailReaderPage } from './MailReaderPage';
import type { MailHeaderStar } from './MailHeader';
import styles from './MailReaderTransition.module.css';
import { revealMailPage } from '../lib/mail/mailReveal';
import { useMailViewed } from './useMailViewed';

export interface ReaderPageOptions {
  interactive: boolean;
  transitionManaged: boolean;
  onReady?: () => void;
  onSlow?: (readNow: () => void) => void;
}

// 按选择挂载单页：旧内容立即释放，过期回调只能更新已卸载实例，不能揭开新目标。
function SelectedPage({
  selected,
  detail,
  error,
  onRetry,
  busy,
  onRefresh,
  starFor,
  onViewed,
}: ReaderProps) {
  const { t } = useTranslation('mail');
  const stage = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(false);
  const [slow, setSlow] = useState<{ read: () => void }>();
  const hasError = error != null;
  const current = detail?.id === selected ? detail : undefined;
  const visible = !!current && ready && elapsed && !hasError;
  useMailViewed(stage, visible && !busy, selected, onViewed);
  useLayoutEffect(() => {
    if (visible && page.current) return revealMailPage(page.current);
  }, [visible]);
  useLayoutEffect(() => {
    const reader = stage.current?.closest('[data-mail-reader]');
    if (reader) reader.scrollTop = 0;
  }, []);
  useEffect(() => {
    // 从选择时开始等待，与网络及图片准备并行，慢邮件不再额外等一轮。
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setElapsed(true), reduced ? 0 : 280);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      ref={stage}
      className={styles.stage}
      data-reader-transition
      data-switch-loading={!visible && !hasError}
      aria-busy={!visible && !hasError}
    >
      {hasError && (
        <div className={styles.status}>
          <p role="alert">{t(api.errorKey(error))}</p>
          <button type="button" onClick={onRetry}>
            {t('retryBody')}
          </button>
        </div>
      )}
      {!visible && !hasError && slow && (
        <div className={styles.status}>
          <p role="status">{t('bodyPreparingSlow')}</p>
          <button type="button" onClick={slow.read}>
            {t('readBeforeImages')}
          </button>
        </div>
      )}
      {!visible && !hasError && <MailSkeleton header fill />}
      {current && (
        <div
          className={styles.page}
          data-mail-page={current.id}
          data-phase={visible ? 'shown' : 'preparing'}
          aria-hidden={!visible}
          ref={(node) => {
            page.current = node;
            if (visible) node?.removeAttribute('inert');
            else node?.setAttribute('inert', '');
          }}
        >
          <MailReaderPage
            detail={current}
            busy={busy}
            onRefresh={onRefresh}
            star={starFor?.(current)}
            options={{
              interactive: visible,
              transitionManaged: true,
              onReady: () => setReady(true),
              onSlow: (read) => setSlow({ read }),
            }}
          />
        </div>
      )}
    </div>
  );
}

interface ReaderProps {
  selected: string;
  detail?: MailDetail;
  error?: unknown;
  onRetry: () => void;
  busy: boolean;
  onRefresh: () => void;
  starFor?: (detail: MailDetail) => MailHeaderStar;
  onViewed?: (id: string) => void;
}

export function MailReaderTransition(props: ReaderProps) {
  const { t } = useTranslation('mail');
  return props.selected ? (
    <SelectedPage key={props.selected} {...props} />
  ) : (
    <p className={styles.empty}>{t('selectMessage')}</p>
  );
}

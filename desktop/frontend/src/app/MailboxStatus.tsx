import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tooltipPosition } from '../components/Tooltip/tooltipPosition';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { errorKey, type AccountSummary } from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import { limitedMessageCount, mailboxState, mailboxStateLabels } from './mailboxState';
import styles from './MailboxStatus.module.css';

interface Props {
  account: AccountSummary;
  onRetry?: (id: string) => Promise<void>;
}

export function MailboxStatus({ account, onRetry }: Props) {
  const { t } = useTranslation('mail');
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState<unknown>();
  const state = mailboxState(account);
  const label = t(mailboxStateLabels[state]);
  const count = account.messageCount;
  const detail =
    state === 'limited'
      ? t('mailboxLimitedHint', { count: limitedMessageCount(account) })
      : state === 'ready' && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
        ? t('mailboxSyncedCount', { count })
        : label;
  const canRetry = state === 'error' && onRetry;
  const contains = (target: EventTarget | null) =>
    target instanceof Node && (root.current?.contains(target) || panel.current?.contains(target));
  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const leave = (target: EventTarget | null) => {
    if (contains(target)) return;
    clearTimeout(timer.current);
    // 给指针留出跨越浮层间隙的时间；键盘焦点仍在其中时不因鼠标离开而关闭。
    timer.current = setTimeout(() => {
      if (!contains(document.activeElement)) setOpen(false);
    }, 180);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!contains(event.target)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node && panel.current?.contains(event.target))) dismiss();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside, true);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside, true);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);
  useLayoutEffect(() => {
    const node = panel.current;
    const anchor = trigger.current;
    if (!open || !node || !anchor) return;
    // 交互层不是纯文本 Tooltip；使用原生 top layer 规避邮箱滚动容器的裁剪。
    if (typeof node.showPopover === 'function') {
      node.setAttribute('popover', 'manual');
      node.showPopover();
    }
    const position = tooltipPosition(
      anchor.getBoundingClientRect(),
      node.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      8,
      12,
      'right',
    );
    node.style.left = `${position.left}px`;
    node.style.top = `${position.top}px`;
    node.style.visibility = 'visible';
    return () => node.hidePopover?.();
  }, [open, detail, retryError, state]);

  const retrySync = async () => {
    if (!onRetry || !canRetry || pending.current) return;
    pending.current = true;
    setBusy(true);
    setRetryError(undefined);
    try {
      await onRetry(account.id);
      trigger.current?.focus({ preventScroll: true });
      setOpen(false);
    } catch (error) {
      setRetryError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <div
      ref={root}
      className={styles.root}
      onMouseEnter={show}
      onMouseLeave={(event) => leave(event.relatedTarget)}
      onBlur={(event) => {
        if (!contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          trigger.current?.focus({ preventScroll: true });
          setOpen(false);
        } else if (event.key === 'Tab' && open) {
          if (!event.shiftKey && event.target === trigger.current && retry.current) {
            event.preventDefault();
            retry.current.focus();
          } else if (event.shiftKey && event.target === retry.current) {
            event.preventDefault();
            trigger.current?.focus();
          } else {
            setOpen(false);
          }
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        data-state={state}
        aria-label={`${account.email} · ${state === 'limited' ? label : detail}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onFocus={show}
        onClick={show}
      >
        <span className={styles.dot} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            className={styles.panel}
            data-native-scrollbar=""
            onMouseEnter={show}
            onMouseLeave={(event) => leave(event.relatedTarget)}
          >
            <strong className={styles.email}>{account.email}</strong>
            <p className={styles.summary}>{detail}</p>
            {state === 'error' && (
              <p className={styles.explanation}>{t(errorKey(account.sync.errorCode))}</p>
            )}
            {state === 'reauth' && <p className={styles.explanation}>{t('reauthHint')}</p>}
            {retryError != null && <p role="alert">{t(errorKey(retryError))}</p>}
            {canRetry && (
              <button
                ref={retry}
                type="button"
                data-button-variant="secondary"
                className={styles.retry}
                disabled={busy}
                onClick={() => void retrySync()}
              >
                <UiIcon name="sync" size={14} />
                {busy ? t('syncing') : t('retrySync')}
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

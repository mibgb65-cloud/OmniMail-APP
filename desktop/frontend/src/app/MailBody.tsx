import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ExternalLinkDialog } from '../components/MailDialogs/ExternalLinkDialog';
import { useTranslation } from '../lib/i18n/useTranslation';
import { buildMailDocument } from '../lib/mail/mailDocument';
import { attachMailFrame } from '../lib/mail/mailFrame';
import { useImagePolicy, type ImagePolicy } from '../lib/preferences/mailImages';
import { useMailFollowsDarkMode } from '../lib/preferences/mailAppearance';
import styles from './MailBody.module.css';
import { MailSkeleton } from './MailSkeleton';

interface BodyOptions {
  interactive?: boolean;
  transitionManaged?: boolean;
  onReady?: () => void;
  onSlow?: (readNow: () => void) => void;
}

function RichBody({
  html,
  text,
  policy,
  interactive = true,
  transitionManaged = false,
  onReady,
  onSlow,
}: { html: string; text: string; policy: ImagePolicy } & BodyOptions) {
  const { t } = useTranslation('mail');
  const [allowed, setAllowed] = useState(false);
  const followDarkMode = useMailFollowsDarkMode();
  const [linkTarget, setLinkTarget] = useState('');
  const [imageError, setImageError] = useState<number>();
  const [readyVersion, setReadyVersion] = useState<number>();
  const [slowVersion, setSlowVersion] = useState<number>();
  const [fallbackVersion, setFallbackVersion] = useState<number>();
  const [earlyVersion, setEarlyVersion] = useState<number>();
  const [animateVersion, setAnimateVersion] = useState<number>();
  const behavior = useRef({ interactive, transitionManaged, onReady, onSlow });
  useLayoutEffect(() => {
    behavior.current = { interactive, transitionManaged, onReady, onSlow };
  }, [interactive, transitionManaged, onReady, onSlow]);
  if (!interactive && linkTarget) setLinkTarget('');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const reveal = useRef(0);
  const prepared = useRef<number>();
  const cleanup = useRef<() => void>(() => {});
  const document = useMemo(
    () => buildMailDocument(html, allowed ? 'all' : policy),
    [html, allowed, policy],
  );
  const source = document.source;
  const [frameIdentity, setFrameIdentity] = useState({ source, version: 0 });
  // srcDoc 改变时新建隔离文档，旧文档的迟到图片/load 回调不能揭开新邮件。
  if (frameIdentity.source !== source)
    setFrameIdentity({ source, version: frameIdentity.version + 1 });
  const version = frameIdentity.version;
  const ready = readyVersion === version;
  const fallback = fallbackVersion === version;
  useEffect(() => {
    if (fallback) cleanup.current();
  }, [fallback]);
  const revealBody = useCallback(() => {
    if (prepared.current === version) return;
    prepared.current = version;
    reveal.current = requestAnimationFrame(() => {
      reveal.current = requestAnimationFrame(() => {
        if (!behavior.current.transitionManaged) setAnimateVersion(version);
        setReadyVersion(version);
      });
    });
  }, [version]);
  const prepare = useCallback(
    (frame: HTMLIFrameElement) => {
      if (!frame.contentDocument?.getElementById('omnimail-content')) return;
      cleanup.current();
      cleanup.current = attachMailFrame(
        frame,
        (url) => {
          if (behavior.current.interactive) setLinkTarget(url);
        },
        () => setImageError(version),
        (layout) => {
          if (layout.oversized) {
            setFallbackVersion(version);
            if (!behavior.current.transitionManaged) setAnimateVersion(version);
            revealBody();
            return;
          }
          revealBody();
        },
      );
    },
    [version, revealBody],
  );
  const readNow = useCallback(() => {
    if (frameRef.current) {
      setEarlyVersion(version);
      prepare(frameRef.current);
    }
  }, [version, prepare]);
  useEffect(() => {
    if (ready || fallback) return;
    const timer = window.setTimeout(() => setSlowVersion(version), 12000);
    return () => window.clearTimeout(timer);
  }, [version, ready, fallback, readNow]);
  const readyCallback = !!onReady;
  const slowCallback = !!onSlow;
  useEffect(() => {
    if ((ready || fallback) && readyCallback) behavior.current.onReady?.();
  }, [ready, fallback, version, readyCallback]);
  useEffect(() => {
    if (slowVersion === version && !ready && slowCallback) behavior.current.onSlow?.(readNow);
  }, [slowVersion, version, ready, slowCallback, readNow]);
  const loaded = useCallback(
    async (frame: HTMLIFrameElement) => {
      const doc = frame.contentDocument;
      if (!doc?.getElementById('omnimail-content')) return;
      await Promise.all(
        [...doc.images]
          .filter((image) => image.hasAttribute('src'))
          .map(async (image) => {
            try {
              await image.decode?.();
            } catch {
              if (frame.isConnected && frame.contentDocument === doc) setImageError(version);
            }
          }),
      );
      if (!frame.isConnected || frame.contentDocument !== doc) return;
      setEarlyVersion(undefined);
      prepare(frame);
    },
    [version, prepare],
  );
  useEffect(() => {
    const frame = frameRef.current;
    // 缓存/热更新时可能已错过 load；仍按相同解码和测量路径就绪，不绕过门禁。
    if (frame?.contentDocument?.readyState === 'complete') void loaded(frame);
    return () => {
      cancelAnimationFrame(reveal.current);
      prepared.current = undefined;
      cleanup.current();
    };
  }, [version, loaded]);
  return (
    <div className={styles.content} aria-busy={!ready && !fallback}>
      {document.blocked > 0 && (
        <div className={styles.notice} role="status" data-mail-reveal>
          <p>{t('imagesBlocked')}</p>
          <p className={styles.hint}>{t('imagesPrivacy')}</p>
          <button
            type="button"
            disabled={!interactive}
            onClick={() => {
              if (interactive) setAllowed(true);
            }}
          >
            {t('showMessageImages')}
          </button>
        </div>
      )}
      {(document.unavailable > 0 || imageError === version) && (
        <p className={styles.hint}>{t('imagesUnavailable')}</p>
      )}
      {interactive && linkTarget && (
        <ExternalLinkDialog key={linkTarget} url={linkTarget} onClose={() => setLinkTarget('')} />
      )}
      <div
        className={styles.viewport}
        data-ready={ready || fallback}
        data-animate={animateVersion === version}
      >
        {!ready && !fallback && <MailSkeleton />}
        {slowVersion === version && !ready && !fallback && (
          <div className={styles.notice}>
            <p>{t('bodyPreparingSlow')}</p>
            <button type="button" disabled={!interactive} onClick={readNow}>
              {t('readBeforeImages')}
            </button>
          </div>
        )}
        {ready && earlyVersion === version && (
          <p className={styles.hint}>{t('bodyImagesPending')}</p>
        )}
        {fallback ? (
          <>
            <p className={styles.hint} data-mail-reveal>
              {t('bodyLayoutFallback')}
            </p>
            <div className={styles.plain} data-mail-reveal>
              {text}
            </div>
          </>
        ) : (
          <iframe
            key={frameIdentity.version}
            ref={frameRef}
            data-mail-frame="safe"
            data-original={!followDarkMode}
            className={styles.frame}
            title={t('richBody')}
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
            scrolling="no"
            aria-hidden={!ready}
            tabIndex={ready ? 0 : -1}
            srcDoc={document.source}
            onLoad={(event) => {
              void loaded(event.currentTarget);
            }}
          />
        )}
      </div>
    </div>
  );
}

function PlainBody({ text, onReady, transitionManaged = false }: { text: string } & BodyOptions) {
  const notify = useRef(onReady);
  const [animate] = useState(!transitionManaged);
  useLayoutEffect(() => {
    notify.current = onReady;
  }, [onReady]);
  const hasReady = !!onReady;
  // 仅拆有限数量的自然段，余下原文保留在最后一段，避免大邮件创建大量装饰节点。
  const parts = text.split(/(\r?\n[ \t]*\r?\n)/, 31);
  const covered = parts.reduce((length, part) => length + part.length, 0);
  if (parts.length) parts[parts.length - 1] += text.slice(covered);
  useEffect(() => {
    const frame = requestAnimationFrame(() => notify.current?.());
    return () => cancelAnimationFrame(frame);
  }, [text, hasReady]);
  return (
    <div className={styles.plain} data-animate={animate}>
      {parts.map((part, index) =>
        index % 2 ? (
          part
        ) : (
          <span key={index} data-mail-reveal>
            {part}
          </span>
        ),
      )}
    </div>
  );
}

export function MailBody({
  id,
  html,
  text,
  ...options
}: { id: string; html?: string; text: string } & BodyOptions) {
  const policy = useImagePolicy();
  if (!html) return <PlainBody text={text} {...options} />;
  // 切换邮件或全局偏好时销毁本封临时授权，不把授权带到其他邮件。
  return <RichBody key={`${id}:${policy}`} html={html} text={text} policy={policy} {...options} />;
}

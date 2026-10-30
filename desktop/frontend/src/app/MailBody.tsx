import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLinkDialog } from '../components/MailDialogs/ExternalLinkDialog';
import { useTranslation } from '../lib/i18n/useTranslation';
import { buildMailDocument } from '../lib/mail/mailDocument';
import { attachMailFrame } from '../lib/mail/mailFrame';
import { useImagePolicy, type ImagePolicy } from '../lib/preferences/mailImages';
import styles from './MailBody.module.css';

function RichBody({ html, policy }: { html: string; policy: ImagePolicy }) {
  const { t } = useTranslation('mail');
  const [allowed, setAllowed] = useState(false);
  const [linkTarget, setLinkTarget] = useState('');
  const [imageError, setImageError] = useState(false);
  const cleanup = useRef<() => void>(() => {});
  const document = useMemo(
    () => buildMailDocument(html, allowed ? 'all' : policy),
    [html, allowed, policy],
  );
  useEffect(() => () => cleanup.current(), []);
  return (
    <div className={styles.content}>
      {document.blocked > 0 && (
        <div className={styles.notice} role="status">
          <p>{t('imagesBlocked')}</p>
          <p className={styles.hint}>{t('imagesPrivacy')}</p>
          <button type="button" onClick={() => setAllowed(true)}>
            {t('showMessageImages')}
          </button>
        </div>
      )}
      {(document.unavailable > 0 || imageError) && (
        <p className={styles.hint}>{t('imagesUnavailable')}</p>
      )}
      {linkTarget && (
        <ExternalLinkDialog key={linkTarget} url={linkTarget} onClose={() => setLinkTarget('')} />
      )}
      <iframe
        data-mail-frame="safe"
        className={styles.frame}
        title={t('richBody')}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        srcDoc={document.source}
        onLoad={(event) => {
          cleanup.current();
          cleanup.current = attachMailFrame(event.currentTarget, setLinkTarget, () =>
            setImageError(true),
          );
        }}
      />
    </div>
  );
}

export function MailBody({ id, html, text }: { id: string; html?: string; text: string }) {
  const policy = useImagePolicy();
  if (!html) return <div className={styles.plain}>{text}</div>;
  // 切换邮件或全局偏好时销毁本封临时授权，不把授权带到其他邮件。
  return <RichBody key={`${id}:${policy}`} html={html} policy={policy} />;
}

import { useEffect, useState } from 'react';

import { useTranslation } from '../../lib/i18n/useTranslation';
import { BrandMark } from '../BrandMark/BrandMark';
import styles from './StartupScreen.module.css';

interface StartupScreenProps {
  loading: boolean;
  onDismiss: () => void;
}

export function StartupScreen({ loading, onDismiss }: StartupScreenProps) {
  const { t } = useTranslation('common');
  const [gate, setGate] = useState<'intro' | 'ready' | 'expired'>('intro');
  const [skipped, setSkipped] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const leaving = skipped || reducedMotion || gate === 'expired' || (gate === 'ready' && !loading);

  useEffect(() => {
    // 仅提供短暂的品牌过渡，不将动画当成实际初始化进度，也不无限等待 IPC。
    const minimum = window.setTimeout(() => setGate('ready'), 1_100);
    const maximum = window.setTimeout(() => setGate('expired'), 3_500);
    return () => {
      window.clearTimeout(minimum);
      window.clearTimeout(maximum);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSkipped(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    // 不依赖 animationend，后台窗口或禁用动画时仍能退出开屏。
    const exit = window.setTimeout(onDismiss, reducedMotion ? 0 : 240);
    return () => window.clearTimeout(exit);
  }, [leaving, onDismiss, reducedMotion]);

  return (
    <section
      className={`${styles.screen} ${leaving ? styles.leaving : ''}`}
      aria-label={t('startupLabel')}
    >
      <div className={styles.center}>
        <div className={styles.wordmark}>
          <BrandMark className={styles.mark} />
          <strong>OmniMail</strong>
        </div>
        <div className={styles.track} aria-hidden="true">
          <span />
        </div>
        <p role="status">{t('startupPreparing')}</p>
      </div>
    </section>
  );
}

import { useEffect, useRef, type RefObject } from 'react';

// 由按邮件 ID 挂载的阅读页使用；状态随该次打开释放，手动未读不会触发重复通知。
export function useMailViewed(
  stage: RefObject<HTMLElement>,
  visible: boolean,
  id: string,
  onViewed?: (id: string) => void,
) {
  const notified = useRef(false);
  useEffect(() => {
    if (!visible || notified.current || !onViewed) return;
    const notify = () => {
      if (
        notified.current ||
        !stage.current?.isConnected ||
        document.visibilityState !== 'visible' ||
        document.querySelector('dialog[open]') ||
        stage.current.closest('[inert], [aria-hidden="true"]')
      )
        return;
      notified.current = true;
      onViewed(id);
    };
    notify();
    if (notified.current) return;
    // 后台、开屏或弹窗遮挡不算已查看；恢复可见时仍只允许当前挂载页通知。
    document.addEventListener('visibilitychange', notify);
    document.addEventListener('close', notify, true);
    const observer = new MutationObserver(notify);
    for (let node = stage.current?.parentElement; node; node = node.parentElement)
      observer.observe(node, { attributes: true, attributeFilter: ['inert', 'aria-hidden'] });
    return () => {
      document.removeEventListener('visibilitychange', notify);
      document.removeEventListener('close', notify, true);
      observer.disconnect();
    };
  }, [stage, visible, id, onViewed]);
}

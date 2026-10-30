import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { tooltipPosition, type TooltipSide } from './tooltipPosition';
import { tooltipFrame, useTooltip, type ActiveTooltip } from './useTooltip';
import styles from './TooltipHost.module.css';

function TooltipBubble({ active, id }: { active: ActiveTooltip; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // top layer 同时避开原生 dialog 遮挡、祖先 overflow 裁剪和入场 transform 的定位影响。
    if (typeof node.showPopover === 'function') {
      // React 18 的类型尚未声明 popover；通过原生 API 渐进增强，不扩宽全局 HTML 类型。
      node.setAttribute('popover', 'manual');
      node.showPopover();
    }
    const css = getComputedStyle(node);
    const spacing = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0;
    const preferred = active.anchor
      .closest('[data-tooltip-side]')
      ?.getAttribute('data-tooltip-side');
    const side: TooltipSide =
      preferred === 'bottom' || preferred === 'left' || preferred === 'right' ? preferred : 'top';
    const rect = active.anchor.getBoundingClientRect();
    const frameRect = tooltipFrame(active.anchor)?.getBoundingClientRect();
    const offsetX = frameRect ? frameRect.left + (tooltipFrame(active.anchor)?.clientLeft ?? 0) : 0;
    const offsetY = frameRect ? frameRect.top + (tooltipFrame(active.anchor)?.clientTop ?? 0) : 0;
    const position = tooltipPosition(
      {
        left: rect.left + offsetX,
        right: rect.right + offsetX,
        top: rect.top + offsetY,
        bottom: rect.bottom + offsetY,
        width: rect.width,
        height: rect.height,
      },
      node.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      spacing('--tooltip-gap'),
      spacing('--tooltip-inset'),
      side,
    );
    node.style.left = `${position.left}px`;
    node.style.top = `${position.top}px`;
    node.style.visibility = 'visible';
    return () => node.hidePopover?.();
  }, [active]);
  const isLink = active.anchor.dataset.tooltipKind === 'link';
  let host = '';
  if (isLink) {
    try {
      const url = new URL(active.text);
      host = url.hostname || url.protocol;
    } catch {
      host = '';
    }
  }
  return (
    <div ref={ref} id={id} role="tooltip" className={styles.tooltip}>
      {isLink ? (
        <>
          <strong className={styles['link-host']}>{host}</strong>
          <span className={styles['link-url']}>{active.text}</span>
        </>
      ) : (
        active.text
      )}
    </div>
  );
}

/** 应用只装配一次；提示由 data-tooltip 声明，不包装或改变原控件布局。 */
export function TooltipHost() {
  const id = `tooltip-${useId()}`;
  const active = useTooltip(id);
  return active ? createPortal(<TooltipBubble active={active} id={id} />, active.container) : null;
}

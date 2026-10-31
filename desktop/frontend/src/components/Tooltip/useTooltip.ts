import { useEffect, useState } from 'react';

export const TOOLTIP_DELAY = 400;
export const TOOLTIP_HIDE_DELAY = 120;

export interface ActiveTooltip {
  anchor: HTMLElement;
  text: string;
  container: HTMLElement;
}

function isNode(target: EventTarget | null): target is Node {
  return target !== null && 'nodeType' in target && typeof target.nodeType === 'number';
}
function isElement(target: EventTarget | null): target is Element {
  return (
    isNode(target) &&
    target.nodeType === 1 &&
    'closest' in target &&
    typeof target.closest === 'function'
  );
}
function tooltipTarget(target: EventTarget | null) {
  return isElement(target) ? target.closest<HTMLElement>('[data-tooltip]') : null;
}

export function tooltipFrame(anchor: HTMLElement) {
  const frame = anchor.ownerDocument.defaultView?.frameElement;
  return frame instanceof HTMLIFrameElement ? frame : undefined;
}

function tooltipText(anchor: HTMLElement) {
  const text = anchor.dataset.tooltip?.trim();
  return text && text.length <= 1024 ? text : '';
}

export function useTooltip(id: string) {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  useEffect(() => {
    let current: HTMLElement | null = null;
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    let visible = false;
    let text = '';
    let pointerInput = false;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const tooltip = () => document.getElementById(id);
    const inside = (element: Element | null, target: EventTarget | null) =>
      isNode(target) && !!element?.contains(target);
    const clearTimers = () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
    const hide = () => {
      clearTimers();
      if (current) {
        // 只移除本提示的关联，不能覆盖原有的错误说明或异步增加的可访问描述。
        const ids = (current.getAttribute('aria-describedby') ?? '')
          .split(/\s+/)
          .filter((value) => value && value !== id);
        if (ids.length) current.setAttribute('aria-describedby', ids.join(' '));
        else current.removeAttribute('aria-describedby');
      }
      current = hovered = focused = null;
      visible = false;
      text = '';
      setActive(null);
    };
    const valid = (anchor: HTMLElement) => {
      const frame = tooltipFrame(anchor);
      const host = frame ?? anchor;
      const dialog = anchor.closest('dialog');
      const modal = document.querySelector('dialog[open]');
      return (
        anchor.isConnected &&
        (anchor.ownerDocument === document ||
          (frame?.isConnected && frame.contentDocument === anchor.ownerDocument)) &&
        !anchor.closest('[inert], [hidden]') &&
        !host.closest('[inert], [hidden]') &&
        (!dialog || dialog.open) &&
        (!modal || modal.contains(host))
      );
    };
    const publish = () => {
      if (!current || !valid(current) || !tooltipText(current)) {
        hide();
        return;
      }
      const next = tooltipText(current);
      if (visible && next === text) return;
      text = next;
      visible = true;
      const ids = new Set(
        (current.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean),
      );
      ids.add(id);
      // 跨文档 IDREF 不能指向主页面；邮件链接自身的 aria-label 已包含完整地址。
      if (current.ownerDocument === document)
        current.setAttribute('aria-describedby', [...ids].join(' '));
      // Portal 保留在 dialog 的模态/无障碍范围内；呈现组件再用 Popover 进入 top layer。
      setActive({ anchor: current, text, container: current.closest('dialog') ?? document.body });
    };
    const show = (anchor: HTMLElement, immediate = false) => {
      clearTimeout(hideTimer);
      if (current === anchor) {
        if (immediate && !visible) {
          clearTimeout(showTimer);
          publish();
        }
        return;
      }
      hide();
      if (!valid(anchor) || !tooltipText(anchor)) return;
      current = anchor;
      if (immediate) publish();
      else showTimer = setTimeout(publish, TOOLTIP_DELAY);
    };
    const scheduleHide = () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, TOOLTIP_HIDE_DELAY);
    };
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (inside(tooltip(), event.target)) {
        clearTimeout(hideTimer);
        return;
      }
      const anchor = tooltipTarget(event.target);
      if (anchor) {
        show(anchor);
        hovered = anchor;
      }
    };
    const out = (event: PointerEvent) => {
      if (inside(current, event.relatedTarget) || inside(tooltip(), event.relatedTarget)) return;
      if (inside(current, event.target) || inside(tooltip(), event.target)) {
        hovered = null;
        if (focused !== current) scheduleHide();
      }
    };
    const focus = (event: FocusEvent) => {
      const anchor = tooltipTarget(event.target);
      if (!anchor || pointerInput) return;
      show(anchor, true);
      focused = anchor;
    };
    const blur = (event: FocusEvent) => {
      if (inside(current, event.relatedTarget)) return;
      focused = null;
      if (hovered !== current) scheduleHide();
    };
    const down = () => {
      pointerInput = true;
      hide();
    };
    const key = (event: KeyboardEvent) => {
      pointerInput = false;
      if (event.key !== 'Escape') return;
      if (visible) {
        // 先关闭可见提示，避免同一次 Esc 顺带关闭用户正在操作的模态窗。
        event.preventDefault();
        event.stopPropagation();
      }
      hide();
    };
    const scroll = (event: Event) => {
      if (!inside(tooltip(), event.target)) hide();
    };
    const bind = (doc: Document) => {
      doc.addEventListener('pointerover', over, true);
      doc.addEventListener('pointerout', out, true);
      doc.addEventListener('focusin', focus, true);
      doc.addEventListener('focusout', blur, true);
      doc.addEventListener('pointerdown', down, true);
      doc.addEventListener('keydown', key, true);
      doc.addEventListener('scroll', scroll, true);
      return () => {
        doc.removeEventListener('pointerover', over, true);
        doc.removeEventListener('pointerout', out, true);
        doc.removeEventListener('focusin', focus, true);
        doc.removeEventListener('focusout', blur, true);
        doc.removeEventListener('pointerdown', down, true);
        doc.removeEventListener('keydown', key, true);
        doc.removeEventListener('scroll', scroll, true);
      };
    };
    const frames = new Map<HTMLIFrameElement, () => void>();
    const watchFrames = () => {
      for (const [frame, stop] of frames) {
        if (!frame.isConnected) {
          stop();
          frames.delete(frame);
        }
      }
      document
        .querySelectorAll<HTMLIFrameElement>('iframe[data-mail-frame="safe"]')
        .forEach((frame) => {
          if (frames.has(frame)) return;
          let release = () => {};
          const load = () => {
            release();
            hide();
            try {
              if (frame.contentDocument) release = bind(frame.contentDocument);
            } catch {
              /* 不接管跨源文档。 */
            }
          };
          frame.addEventListener('load', load);
          frames.set(frame, () => {
            release();
            frame.removeEventListener('load', load);
          });
          load();
        });
    };
    const mutations = new MutationObserver(() => {
      watchFrames();
      if (current) {
        if (!valid(current) || !tooltipText(current)) hide();
        else if (visible) publish();
      }
    });
    mutations.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-tooltip', 'open', 'inert', 'hidden'],
    });
    const unbind = bind(document);
    watchFrames();
    window.addEventListener('blur', hide);
    window.addEventListener('resize', hide);
    return () => {
      mutations.disconnect();
      hide();
      unbind();
      frames.forEach((stop) => stop());
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', hide);
    };
  }, [id]);
  return active;
}

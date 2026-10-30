import { useEffect, useState } from 'react';

export const TOOLTIP_DELAY = 400;
export const TOOLTIP_HIDE_DELAY = 120;

export interface ActiveTooltip {
  anchor: HTMLElement;
  text: string;
  container: HTMLElement;
}

function tooltipTarget(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;
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
      target instanceof Node && !!element?.contains(target);
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
      const dialog = anchor.closest('dialog');
      const modal = document.querySelector('dialog[open]');
      return (
        anchor.isConnected &&
        !anchor.closest('[inert], [hidden]') &&
        (!dialog || dialog.open) &&
        (!modal || modal.contains(anchor))
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
    const mutations = new MutationObserver(() => {
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
    document.addEventListener('pointerover', over, true);
    document.addEventListener('pointerout', out, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('focusout', blur, true);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('blur', hide);
    window.addEventListener('resize', hide);
    return () => {
      mutations.disconnect();
      hide();
      document.removeEventListener('pointerover', over, true);
      document.removeEventListener('pointerout', out, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('focusout', blur, true);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', hide);
    };
  }, [id]);
  return active;
}

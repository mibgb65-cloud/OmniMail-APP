import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { SUPPORTED_LOCALES, type Locale } from '../../lib/i18n/resources';
import { placeLanguageMenu } from './placeLanguageMenu';

export function useLanguageMenu(locale: Locale, onChange: (next: Locale) => void) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<DOMRect | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!open || !menu || !trigger) return;
    // 顶层 popover 不受原生 dialog 的滚动区域裁切，Esc 等行为仍由共享逻辑控制。
    if (typeof menu.showPopover === 'function') {
      menu.setAttribute('popover', 'manual');
      menu.showPopover();
    }
    placeLanguageMenu(menu, trigger);
    anchorRef.current = trigger.getBoundingClientRect();
    return () => {
      anchorRef.current = null;
      if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open'))
        menu.hidePopover();
    };
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus({ preventScroll: true });
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissWindow = () => setOpen(false);
    const dismissMovedAnchor = (event: Event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      const previous = anchorRef.current;
      const current = triggerRef.current?.getBoundingClientRect();
      // 忽略点击前 scrollIntoView 的晚到事件，只有锚点确实移动才关闭菜单。
      if (previous && current && (previous.top !== current.top || previous.left !== current.left)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside, true);
    document.addEventListener('scroll', dismissMovedAnchor, true);
    window.addEventListener('blur', dismissWindow);
    window.addEventListener('resize', dismissWindow);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside, true);
      document.removeEventListener('scroll', dismissMovedAnchor, true);
      window.removeEventListener('blur', dismissWindow);
      window.removeEventListener('resize', dismissWindow);
    };
  }, [open]);

  const show = (index = SUPPORTED_LOCALES.indexOf(locale)) => {
    setActiveIndex(index);
    setOpen(true);
  };
  const hide = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const select = (next: Locale) => {
    onChange(next);
    hide(true);
  };
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      show(event.key === 'ArrowDown' ? 0 : SUPPORTED_LOCALES.length - 1);
    }
  };
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      // 菜单优先消费 Esc，避免同时触发后方开屏的跳过行为。
      event.stopPropagation();
      hide(true);
    } else if (event.key === 'Tab') {
      // 先回到触发按钮，再由浏览器完成下一步 Tab 导航，不困住焦点。
      hide(true);
    } else {
      const count = SUPPORTED_LOCALES.length;
      let index: number;
      if (event.key === 'ArrowDown') index = (activeIndex + 1) % count;
      else if (event.key === 'ArrowUp') index = (activeIndex - 1 + count) % count;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = count - 1;
      else return;
      event.preventDefault();
      setActiveIndex(index);
    }
  };

  return {
    open,
    activeIndex,
    rootRef,
    triggerRef,
    menuRef,
    itemRefs,
    show,
    hide,
    select,
    onTriggerKeyDown,
    onMenuKeyDown,
  };
}

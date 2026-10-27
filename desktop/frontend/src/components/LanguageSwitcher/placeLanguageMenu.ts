export function placeLanguageMenu(menu: HTMLDivElement, trigger: HTMLButtonElement) {
  const gap = Number.parseFloat(getComputedStyle(menu).getPropertyValue('--space-3')) || 8;
  const anchor = trigger.getBoundingClientRect();
  const panel = menu.getBoundingClientRect();
  const left = Math.max(gap, Math.min(anchor.right - panel.width, innerWidth - panel.width - gap));
  const below = anchor.bottom + gap;
  const top =
    below + panel.height <= innerHeight - gap
      ? below
      : Math.max(gap, anchor.top - panel.height - gap);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

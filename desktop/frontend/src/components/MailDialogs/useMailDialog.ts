import { useEffect, useRef } from 'react';

export function useMailDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector<HTMLElement>('select, input, button')?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return ref;
}

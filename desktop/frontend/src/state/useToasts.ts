import { useCallback, useState } from "react";
import type { ToastNotice } from "../types/ui";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (notice: Omit<ToastNotice, "id">, durationMs = 4500) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { ...notice, id }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
      return id;
    },
    [],
  );

  return { toasts, pushToast, dismissToast };
}

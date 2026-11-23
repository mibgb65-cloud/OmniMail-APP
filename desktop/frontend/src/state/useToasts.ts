import { useCallback, useRef, useState } from "react";
import type { ToastNotice } from "../types/ui";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const timersRef = useRef<
    Record<string, { timer: number; remaining: number; start: number }>
  >({});

  const dismissToast = useCallback((id: string) => {
    const entry = timersRef.current[id];
    if (entry) {
      window.clearTimeout(entry.timer);
      delete timersRef.current[id];
    }
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 150);
  }, []);

  const pauseToast = useCallback((id: string) => {
    const entry = timersRef.current[id];
    if (!entry) return;
    window.clearTimeout(entry.timer);
    entry.remaining = Math.max(
      400,
      entry.remaining - (Date.now() - entry.start),
    );
  }, []);

  const resumeToast = useCallback(
    (id: string) => {
      const entry = timersRef.current[id];
      if (!entry) return;
      entry.start = Date.now();
      entry.timer = window.setTimeout(() => dismissToast(id), entry.remaining);
    },
    [dismissToast],
  );

  const pushToast = useCallback(
    (notice: Omit<ToastNotice, "id">, durationMs = 4500) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [
        ...prev.slice(-2),
        { ...notice, id, durationMs, exiting: false },
      ]);
      const timer = window.setTimeout(() => dismissToast(id), durationMs);
      timersRef.current[id] = {
        timer,
        remaining: durationMs,
        start: Date.now(),
      };
      return id;
    },
    [dismissToast],
  );

  return { toasts, pushToast, dismissToast, pauseToast, resumeToast };
}

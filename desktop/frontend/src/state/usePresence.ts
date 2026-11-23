import { useEffect, useState } from "react";

export function usePresence(open: boolean, exitMs: number) {
  const [prevOpen, setPrevOpen] = useState(open);
  const [mounted, setMounted] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMounted(true);
    }
  }

  const closing = !open && mounted;

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [closing, exitMs]);

  return { mounted: open || mounted, closing };
}

export function useValuePresence<T>(value: T | null, exitMs: number) {
  const [prevValue, setPrevValue] = useState(value);
  const [latched, setLatched] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== null) {
      setLatched(value);
    }
  }

  const closing = value === null && latched !== null;

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      setLatched(null);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [closing, exitMs]);

  return { rendered: value ?? latched, closing };
}

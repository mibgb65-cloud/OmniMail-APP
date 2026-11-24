import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { getReaderToolbarLayout } from "./readerToolbarLayout";

export function useReaderToolbarLayout() {
  const { lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = getReaderToolbarLayout(width, lang);
  return { ref, layout };
}

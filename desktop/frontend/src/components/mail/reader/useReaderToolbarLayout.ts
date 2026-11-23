import { useLayoutEffect, useRef, useState } from "react";
import { getReaderToolbarLayout } from "./readerToolbarLayout";

export function useReaderToolbarLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(() => getReaderToolbarLayout(0));

  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setLayout(getReaderToolbarLayout(entry.contentRect.width));
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, layout };
}

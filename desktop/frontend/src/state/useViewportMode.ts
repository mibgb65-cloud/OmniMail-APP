import { useEffect, useState } from "react";

export type ViewportMode = "wide" | "laptop" | "compact";

function readViewportMode(): ViewportMode {
  if (typeof window === "undefined") return "wide";
  const w = window.innerWidth;
  if (w <= 1024) return "compact";
  if (w < 1440) return "laptop";
  return "wide";
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(readViewportMode);

  useEffect(() => {
    const onResize = () => {
      const next = readViewportMode();
      setMode((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return mode;
}

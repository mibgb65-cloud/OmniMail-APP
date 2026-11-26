import { useCallback, useState, type SyntheticEvent } from "react";
import type { ThemeMode } from "../../../types/settings";
import type { LightboxImageItem } from "../../../types/ui";
import {
  analyzeImageElementSurface,
  resolveLightboxPresentation,
  type ImageSurfaceReport,
  type LightboxSurfaceChoice,
} from "./imageSurfaceAnalysis";

export function useLightboxGalleryState(
  images: LightboxImageItem[],
  initialIndex: number,
  appTheme: ThemeMode,
  onResetViewport: () => void,
) {
  const [index, setIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)),
  );
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>(
    {},
  );
  const [reports, setReports] = useState<Record<string, ImageSurfaceReport>>(
    {},
  );
  const [manualSurface, setManualSurface] =
    useState<LightboxSurfaceChoice | null>(null);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [retryTick, setRetryTick] = useState(0);

  const goTo = useCallback(
    (next: number) => {
      if (images.length === 0) return;
      setIndex(((next % images.length) + images.length) % images.length);
      onResetViewport();
    },
    [images.length, onResetViewport],
  );

  const current = images[index];
  const dim = current
    ? (dims[current.id] ??
      (current.width && current.height
        ? { w: current.width, h: current.height }
        : null))
    : null;
  const subtitle = current
    ? [current.sourceLabel, dim ? `${dim.w} × ${dim.h} px` : ""]
        .filter(Boolean)
        .join(" · ")
    : "";
  const pres = resolveLightboxPresentation({
    appTheme,
    manualSurface,
    report: current ? reports[current.id] : undefined,
  });
  const imgSrc =
    current && retryTick > 0 && !current.src.startsWith("data:")
      ? `${current.src}${current.src.includes("?") ? "&" : "?"}lb=${retryTick}`
      : (current?.src ?? "");

  const handleImgLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (!current) return;
    const el = e.currentTarget;
    if (el.naturalWidth > 0 && el.naturalHeight > 0) {
      const nextDim = { w: el.naturalWidth, h: el.naturalHeight };
      setDims((prev) => ({ ...prev, [current.id]: nextDim }));
    }
    const surface = analyzeImageElementSurface(el, current.src, current.name);
    setReports((prev) => ({ ...prev, [current.id]: surface }));
  };

  const markCurrentFailed = () => {
    if (!current) return;
    setFailedIds((prev) => ({ ...prev, [current.id]: true }));
  };

  const retryCurrent = () => {
    if (!current) return;
    setFailedIds((prev) => ({ ...prev, [current.id]: false }));
    setRetryTick((n) => n + 1);
  };

  return {
    index,
    current,
    subtitle,
    pres,
    imgSrc,
    retryTick,
    isFailed: Boolean(current && failedIds[current.id]),
    setManualSurface,
    goTo,
    handleImgLoad,
    markCurrentFailed,
    retryCurrent,
  };
}

import type { ThemeMode } from "../../../types/settings";

export type LightboxSurfaceChoice = "checker" | "light" | "dark";
export type RecommendedSurface = LightboxSurfaceChoice | "none";

export interface ImageSurfaceReport {
  hasTransparency: boolean;
  transparentRatio: number;
  avgLuminance: number | null;
  isSmallLogo: boolean;
  recommendedSurface: RecommendedSurface;
  corsFallback: boolean;
}

const SAMPLE_SIZE = 32;
const ALPHA_CUTOFF = 245;
const TRANSPARENT_RATIO_MIN = 0.05;
const DARK_LUM_CUTOFF = 135;
const LIGHT_LUM_CUTOFF = 185;

export function isSmallLogoDimension(width: number, height: number): boolean {
  return width > 0 && height > 0 && width < 420 && height < 220;
}

export function analyzeRgbaPixels(
  data: ArrayLike<number>,
  naturalWidth: number,
  naturalHeight: number,
): ImageSurfaceReport {
  const isSmallLogo = isSmallLogoDimension(naturalWidth, naturalHeight);
  const totalPixels = Math.floor(data.length / 4);
  if (totalPixels <= 0) {
    return {
      hasTransparency: false,
      transparentRatio: 0,
      avgLuminance: null,
      isSmallLogo,
      recommendedSurface: "none",
      corsFallback: false,
    };
  }

  let transparentCount = 0;
  let lumWeightedSum = 0;
  let alphaWeightSum = 0;
  for (let i = 0; i < totalPixels * 4; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 255;
    if (a < ALPHA_CUTOFF) transparentCount += 1;
    if (a > 12) {
      const w = a / 255;
      lumWeightedSum += (0.299 * r + 0.587 * g + 0.114 * b) * w;
      alphaWeightSum += w;
    }
  }

  const transparentRatio = transparentCount / totalPixels;
  const hasTransparency = transparentRatio > TRANSPARENT_RATIO_MIN;
  const avgLuminance =
    alphaWeightSum > 0 ? lumWeightedSum / alphaWeightSum : null;

  let recommendedSurface: RecommendedSurface = "none";
  if (hasTransparency) {
    if (avgLuminance !== null && avgLuminance < DARK_LUM_CUTOFF) {
      recommendedSurface = "light";
    } else if (avgLuminance !== null && avgLuminance >= LIGHT_LUM_CUTOFF) {
      recommendedSurface = "dark";
    } else {
      recommendedSurface = "checker";
    }
  }

  return {
    hasTransparency,
    transparentRatio,
    avgLuminance,
    isSmallLogo,
    recommendedSurface,
    corsFallback: false,
  };
}

export function inferFallbackSurfaceFromSource(
  src: string,
  name: string,
  naturalWidth: number,
  naturalHeight: number,
): ImageSurfaceReport {
  const isSmallLogo = isSmallLogoDimension(naturalWidth, naturalHeight);
  const cleanSrc = src.split(/[?#]/)[0] ?? "";
  const combined = `${name} ${cleanSrc}`.toLowerCase();
  const mayHaveAlpha = /\.(png|webp|svg|gif|ico)(\b|$)/.test(combined);
  const looksLikeLogo = /(logo|icon|badge|brand|mark|avatar|sig)/.test(
    combined,
  );
  let recommendedSurface: RecommendedSurface = "none";
  if (mayHaveAlpha && (isSmallLogo || looksLikeLogo)) {
    recommendedSurface = "light";
  } else if (mayHaveAlpha) {
    recommendedSurface = "checker";
  }
  return {
    hasTransparency: mayHaveAlpha,
    transparentRatio: 0,
    avgLuminance: null,
    isSmallLogo,
    recommendedSurface,
    corsFallback: true,
  };
}

export function analyzeImageElementSurface(
  img: HTMLImageElement,
  src: string,
  name: string,
): ImageSurfaceReport {
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  try {
    if (typeof document === "undefined") {
      return inferFallbackSurfaceFromSource(src, name, w, h);
    }
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return inferFallbackSurfaceFromSource(src, name, w, h);
    ctx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const pixels = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    return analyzeRgbaPixels(pixels, w, h);
  } catch {
    return inferFallbackSurfaceFromSource(src, name, w, h);
  }
}

export function resolveLightboxPresentation(params: {
  appTheme: ThemeMode;
  manualSurface: LightboxSurfaceChoice | null;
  report: ImageSurfaceReport | undefined;
}): {
  activeChoice: LightboxSurfaceChoice;
  canvasTone: ThemeMode;
  pureDark: boolean;
  matSurface: LightboxSurfaceChoice | null;
  autoHintKind: LightboxSurfaceChoice | null;
} {
  const { appTheme, manualSurface, report } = params;
  const rec = report?.recommendedSurface ?? "none";
  const needsMat = Boolean(report?.hasTransparency || report?.isSmallLogo);

  if (manualSurface === "checker") {
    return {
      activeChoice: "checker",
      canvasTone: appTheme,
      pureDark: false,
      matSurface: "checker",
      autoHintKind: null,
    };
  }
  if (manualSurface === "light") {
    return {
      activeChoice: "light",
      canvasTone: "light",
      pureDark: false,
      matSurface: needsMat ? "light" : null,
      autoHintKind: null,
    };
  }
  if (manualSurface === "dark") {
    return {
      activeChoice: "dark",
      canvasTone: "dark",
      pureDark: true,
      matSurface: null,
      autoHintKind: null,
    };
  }
  if (rec !== "none") {
    return {
      activeChoice: rec,
      canvasTone: appTheme,
      pureDark: false,
      matSurface: rec,
      autoHintKind: report?.hasTransparency ? rec : null,
    };
  }
  if (report?.isSmallLogo) {
    return {
      activeChoice: "light",
      canvasTone: appTheme,
      pureDark: false,
      matSurface: "light",
      autoHintKind: null,
    };
  }
  return {
    activeChoice: appTheme === "light" ? "light" : "dark",
    canvasTone: appTheme,
    pureDark: false,
    matSurface: null,
    autoHintKind: null,
  };
}

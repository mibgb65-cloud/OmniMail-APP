export type TopBarUpdateTier = "wide" | "laptop" | "compact" | "ultra";

export type UpdateFlowState =
  | "idle"
  | "available"
  | "downloading"
  | "verifying"
  | "ready"
  | "installing"
  | "error";

export function formatVersionTag(raw?: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "v0.0.1";
  if (s.startsWith("V")) return `v${s.slice(1)}`;
  return s.startsWith("v") ? s : `v${s}`;
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "--";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(bytes)} B`;
}

export function formatSpeedBps(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "";
  if (bps >= 1024 * 1024) {
    return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bps >= 1024) {
    return `${Math.max(1, Math.round(bps / 1024))} KB/s`;
  }
  return `${Math.round(bps)} B/s`;
}

function cleanMarkdownInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractReleaseHighlights(
  markdown: string,
  maxItems = 5,
): string[] {
  const rawLines = (markdown ?? "").split(/\r?\n/);
  const bullets: string[] = [];
  const paragraphs: string[] = [];

  for (const raw of rawLines) {
    const line = raw.trim();
    if (
      !line ||
      line.startsWith("#") ||
      line.startsWith("```") ||
      line.startsWith(">")
    ) {
      continue;
    }
    const bulletMatch = line.match(/^(?:[-*•+]|\d+[.)])\s+(.+)$/);
    if (bulletMatch?.[1]) {
      const cleaned = cleanMarkdownInline(bulletMatch[1]);
      if (cleaned && !bullets.includes(cleaned)) {
        bullets.push(cleaned);
      }
      if (bullets.length >= maxItems) break;
      continue;
    }
    const cleanedPara = cleanMarkdownInline(line);
    if (
      cleanedPara.length >= 4 &&
      !cleanedPara.startsWith("---") &&
      !cleanedPara.toLowerCase().startsWith("sha256")
    ) {
      paragraphs.push(cleanedPara);
    }
  }

  if (bullets.length > 0) {
    return bullets.slice(0, maxItems);
  }
  return paragraphs.slice(0, maxItems);
}

export function resolveTopBarUpdateTier(windowWidth: number): TopBarUpdateTier {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return "wide";
  if (windowWidth < 860) return "ultra";
  if (windowWidth <= 1024) return "compact";
  if (windowWidth < 1440) return "laptop";
  return "wide";
}

export interface UpdatePopoverLayout {
  top: number;
  left: number;
  width: number;
  notesMaxHeight: number;
}

export function computeUpdatePopoverLayout(
  anchorRect: { top: number; bottom: number; left: number; right: number },
  viewportWidth: number,
  viewportHeight: number,
  isCompact: boolean,
): UpdatePopoverLayout {
  const baseWidth = isCompact ? 356 : 396;
  const width = Math.max(240, Math.min(baseWidth, viewportWidth - 24));
  const preferredLeft = anchorRect.right - width;
  const left = Math.round(
    Math.max(12, Math.min(preferredLeft, viewportWidth - width - 12)),
  );
  const top = Math.round(anchorRect.bottom + 8);
  const notesMaxHeight = Math.max(
    84,
    Math.min(220, Math.floor(viewportHeight - 300)),
  );
  return { top, left, width, notesMaxHeight };
}

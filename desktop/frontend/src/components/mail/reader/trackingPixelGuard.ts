const BEACON_PATH_RE =
  /(?:^|[/?&._=-])(?:collect|beacon|open|pixel|track|tracker|telemetry|wf\/open|mailopen|upoint\.gif)(?:[/?&._=-]|$)/i;

const STYLE_HIDDEN_RE =
  /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?)\s*(?:!important)?\s*(?:;|$)/i;

const STYLE_WIDTH_RE = /(?:^|;)\s*(?:max-)?width\s*:\s*([^;!]+)/i;
const STYLE_HEIGHT_RE = /(?:^|;)\s*(?:max-)?height\s*:\s*([^;!]+)/i;

export function parseDeclaredPixelDim(
  raw: string | null | undefined,
): number | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "auto" || s.endsWith("%")) return null;
  const m = /^(\d+(?:\.\d+)?)(px|pt)?$/.exec(s);
  if (!m) return null;
  const val = Number(m[1]);
  return Number.isFinite(val) ? val : null;
}

export interface TrackingPixelMeta {
  hasHiddenAttr?: boolean;
  style?: string | null;
  widthAttr?: string | null;
  heightAttr?: string | null;
  alt?: string | null;
  src?: string | null;
  hasCid?: boolean;
}

export function isTrackingPixelMeta(meta: TrackingPixelMeta): boolean {
  if (meta.hasHiddenAttr) return true;

  const style = meta.style ?? "";
  if (style && STYLE_HIDDEN_RE.test(style)) {
    return true;
  }

  const wAttr = parseDeclaredPixelDim(meta.widthAttr);
  const hAttr = parseDeclaredPixelDim(meta.heightAttr);
  const wStyle = parseDeclaredPixelDim(STYLE_WIDTH_RE.exec(style)?.[1]);
  const hStyle = parseDeclaredPixelDim(STYLE_HEIGHT_RE.exec(style)?.[1]);

  const dims = [wAttr, hAttr, wStyle, hStyle].filter(
    (d): d is number => d !== null,
  );
  if (dims.some((d) => d <= 3)) {
    return true;
  }

  const alt = (meta.alt ?? "").trim();
  const src = (meta.src ?? "").trim();
  const lowSrc = src.toLowerCase();
  const isCid =
    Boolean(meta.hasCid) ||
    lowSrc.startsWith("cid:") ||
    lowSrc.includes("/omnimail-cid/") ||
    lowSrc.includes("/omnimail-attachment/");

  if (!alt && !isCid && src) {
    const hasExplicitLargeDim = dims.some((d) => d > 16);
    if (!hasExplicitLargeDim && BEACON_PATH_RE.test(src)) {
      return true;
    }
  }
  return false;
}

export function isHiddenOrTrackingPixel(img: HTMLImageElement): boolean {
  const src =
    img.dataset.omnimailOrigSrc ||
    img.getAttribute("src") ||
    img.getAttribute("data-omnimail-src") ||
    "";
  return isTrackingPixelMeta({
    hasHiddenAttr: img.hasAttribute("hidden"),
    style: img.getAttribute("style"),
    widthAttr: img.getAttribute("width"),
    heightAttr: img.getAttribute("height"),
    alt: img.getAttribute("alt"),
    src,
    hasCid:
      img.hasAttribute("data-omnimail-cid") ||
      img.hasAttribute("data-omnimail-cid-missing"),
  });
}

const TAG_HIDDEN_ATTR_RE = /\bhidden(?:\s*=|\s|>|\/)/i;
const TAG_STYLE_RE = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const TAG_WIDTH_RE = /\bwidth\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/i;
const TAG_HEIGHT_RE = /\bheight\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/i;
const TAG_ALT_RE = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const TAG_CID_RE = /\bdata-omnimail-cid(?:-missing)?\b/i;

export function isTrackingPixelImgTag(rawImgTag: string, src: string): boolean {
  const styleMatch = TAG_STYLE_RE.exec(rawImgTag);
  const wMatch = TAG_WIDTH_RE.exec(rawImgTag);
  const hMatch = TAG_HEIGHT_RE.exec(rawImgTag);
  const altMatch = TAG_ALT_RE.exec(rawImgTag);
  return isTrackingPixelMeta({
    hasHiddenAttr: TAG_HIDDEN_ATTR_RE.test(rawImgTag),
    style: styleMatch?.[1] ?? styleMatch?.[2] ?? "",
    widthAttr: wMatch?.[1] ?? wMatch?.[2] ?? wMatch?.[3] ?? "",
    heightAttr: hMatch?.[1] ?? hMatch?.[2] ?? hMatch?.[3] ?? "",
    alt: altMatch?.[1] ?? altMatch?.[2] ?? "",
    src,
    hasCid: TAG_CID_RE.test(rawImgTag),
  });
}

export function classifyFailedImageKind(
  img: HTMLImageElement,
): "inline" | "remote" | "blocked-or-empty" {
  const origSrc = (
    img.dataset.omnimailOrigSrc ||
    img.getAttribute("src") ||
    ""
  ).trim();
  const lowSrc = origSrc.toLowerCase();
  const hasInlineCid =
    img.hasAttribute("data-omnimail-cid-missing") ||
    img.hasAttribute("data-omnimail-cid") ||
    lowSrc.startsWith("cid:") ||
    lowSrc.startsWith("/omnimail-cid/") ||
    lowSrc.includes("/omnimail-cid/");

  if (hasInlineCid) return "inline";
  if (!origSrc) return "blocked-or-empty";
  if (lowSrc.startsWith("http://") || lowSrc.startsWith("https://")) {
    return "remote";
  }
  return "inline";
}

import type { AttachmentItem } from "../../../types/mail.ts";
import type { LightboxImageItem } from "../../../types/ui.ts";
import { isTrackingPixelImgTag } from "./trackingPixelGuard.ts";

export const MIN_ZOOMABLE_IMAGE_DIM = 48;

export function isZoomableImageSize(width: number, height: number): boolean {
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width >= MIN_ZOOMABLE_IMAGE_DIM &&
    height >= MIN_ZOOMABLE_IMAGE_DIM
  );
}

export function normalizeImageKey(src: string, attachmentId?: string): string {
  if (attachmentId && attachmentId.trim()) {
    return `att:${attachmentId.trim().toLowerCase()}`;
  }
  const clean = src.trim().replace(/[?#].*$/, "");
  return `src:${clean}`;
}

export function extractAttachmentIdFromSrc(
  src: string,
  dataCidAttr?: string | null,
): string | undefined {
  const attr = dataCidAttr?.trim();
  if (attr) return attr;
  const clean = src.trim().replace(/[?#].*$/, "");
  const cidPrefix = "/omnimail-cid/";
  const attPrefix = "/omnimail-attachment/";
  for (const prefix of [cidPrefix, attPrefix]) {
    const idx = clean.indexOf(prefix);
    if (idx >= 0) {
      const raw = clean.slice(idx + prefix.length);
      if (raw) {
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
    }
  }
  return undefined;
}

export function inferImageNameFromSrc(
  src: string,
  alt: string | null | undefined,
  fallbackName: string,
): string {
  const trimmedAlt = alt?.trim();
  if (trimmedAlt && trimmedAlt.length <= 80) {
    return trimmedAlt;
  }
  const clean = src.trim().replace(/[?#].*$/, "");
  if (!clean.startsWith("data:") && !clean.startsWith("blob:")) {
    const seg = clean.split("/").pop() ?? "";
    if (seg && !seg.startsWith("dimg-") && !seg.includes("-att-")) {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    }
  }
  return fallbackName;
}

const IMG_TAG_RE = /<img\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;
const ATTR_SRC_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const ATTR_ALT_RE = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const ATTR_CID_RE = /\bdata-omnimail-cid\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

export function extractBodyImagesFromHtml(
  htmlList: Array<string | undefined>,
  defaultName: string,
  sourceLabel: string,
): LightboxImageItem[] {
  const out: LightboxImageItem[] = [];
  const seen = new Set<string>();
  let seq = 0;

  for (const html of htmlList) {
    if (!html) continue;
    const tags = html.match(IMG_TAG_RE) ?? [];
    for (const tag of tags) {
      const sm = ATTR_SRC_RE.exec(tag);
      const src = (sm?.[1] ?? sm?.[2] ?? "").trim();
      if (!src || isTrackingPixelImgTag(tag, src)) continue;
      const cm = ATTR_CID_RE.exec(tag);
      const am = ATTR_ALT_RE.exec(tag);
      const attachmentId = extractAttachmentIdFromSrc(src, cm?.[1] ?? cm?.[2]);
      const key = normalizeImageKey(src, attachmentId);
      if (seen.has(key)) continue;
      seen.add(key);
      seq += 1;
      out.push({
        id: `body-img-${seq}`,
        src,
        name: inferImageNameFromSrc(
          src,
          am?.[1] ?? am?.[2],
          `${defaultName} ${seq}`,
        ),
        sourceLabel,
        attachmentId,
      });
    }
  }
  return out;
}

export function mergeMailLightboxGallery(
  bodyImages: LightboxImageItem[],
  attachments: AttachmentItem[],
  labels: { body: string; attachment: string },
): LightboxImageItem[] {
  const merged: LightboxImageItem[] = [];
  const seen = new Set<string>();

  for (const img of bodyImages) {
    if (!img.src) continue;
    const key = normalizeImageKey(img.src, img.attachmentId);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...img,
      sourceLabel: img.sourceLabel || labels.body,
    });
  }

  for (const att of attachments) {
    if (att.kind !== "image") continue;
    const src =
      att.previewUrl ||
      (att.status === "ready"
        ? `/omnimail-attachment/${encodeURIComponent(att.id)}`
        : "");
    if (!src) continue;
    const key = normalizeImageKey(src, att.id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      id: `att-img-${att.id}`,
      src,
      name: att.name,
      sourceLabel: labels.attachment,
      attachmentId: att.id,
    });
  }

  return merged;
}

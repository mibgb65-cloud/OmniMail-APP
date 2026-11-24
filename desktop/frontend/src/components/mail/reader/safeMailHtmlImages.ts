import type { LightboxImageItem } from "../../../types/ui";
import {
  extractAttachmentIdFromSrc,
  inferImageNameFromSrc,
  isZoomableImageSize,
} from "./mailImageGallery";

export interface ShadowImageOptions {
  fallbackText: string;
  retryLabel: string;
  retryingLabel: string;
  defaultImageName: string;
  bodySourceLabel: string;
  onOpenImage?: (images: LightboxImageItem[], activeIndex: number) => void;
  onRetryInlineCid?: (attachmentId: string) => Promise<void>;
}

const BROKEN_IMG_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

function isInsideLink(img: HTMLImageElement): boolean {
  return Boolean(img.closest("a[href]"));
}

function showFallbackCard(
  img: HTMLImageElement,
  opts: ShadowImageOptions,
  cleanups: Array<() => void>,
): void {
  const existing = img.nextElementSibling;
  if (existing?.classList.contains("omnimail-img-fallback")) return;

  img.style.display = "none";
  img.removeAttribute("data-zoomable");

  const card = document.createElement("span");
  card.className = "omnimail-img-fallback";
  card.setAttribute("role", "status");

  const icon = document.createElement("span");
  icon.className = "omnimail-img-fallback-icon";
  icon.innerHTML = BROKEN_IMG_SVG;

  const text = document.createElement("span");
  text.textContent = opts.fallbackText;
  card.append(icon, text);

  const origSrc = img.dataset.omnimailOrigSrc || img.getAttribute("src") || "";
  const attId = extractAttachmentIdFromSrc(
    origSrc,
    img.getAttribute("data-omnimail-cid"),
  );

  if (origSrc || attId) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "omnimail-img-retry-btn";
    btn.textContent = opts.retryLabel;

    const onRetry = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      btn.disabled = true;
      btn.textContent = opts.retryingLabel;
      const reloadImg = () => {
        const base =
          origSrc ||
          (attId ? `/omnimail-cid/${encodeURIComponent(attId)}` : "");
        if (!base) {
          btn.disabled = false;
          btn.textContent = opts.retryLabel;
          return;
        }
        const sep = base.includes("?") ? "&" : "?";
        const nextSrc = base.startsWith("data:")
          ? base
          : `${base}${sep}retry=${Date.now()}`;
        img.style.display = "";
        img.removeAttribute("data-omnimail-cid-missing");
        img.setAttribute("src", nextSrc);
      };
      if (attId && opts.onRetryInlineCid) {
        void opts
          .onRetryInlineCid(attId)
          .catch(() => undefined)
          .finally(reloadImg);
      } else {
        reloadImg();
      }
    };
    btn.addEventListener("click", onRetry);
    cleanups.push(() => btn.removeEventListener("click", onRetry));
    card.appendChild(btn);
  }

  img.insertAdjacentElement("afterend", card);
}

function clearFallbackCard(img: HTMLImageElement): void {
  const next = img.nextElementSibling;
  if (next?.classList.contains("omnimail-img-fallback")) {
    next.remove();
  }
  img.style.display = "";
}

export function attachShadowImageEnhancements(
  root: ShadowRoot,
  opts: ShadowImageOptions,
): () => void {
  const cleanups: Array<() => void> = [];
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));

  const markIfZoomable = (img: HTMLImageElement) => {
    clearFallbackCard(img);
    if (
      isZoomableImageSize(img.naturalWidth, img.naturalHeight) &&
      !isInsideLink(img)
    ) {
      img.setAttribute("data-zoomable", "true");
    } else {
      img.removeAttribute("data-zoomable");
    }
  };

  for (const img of imgs) {
    const rawSrc = img.getAttribute("src")?.trim() ?? "";
    if (rawSrc && !img.dataset.omnimailOrigSrc) {
      img.dataset.omnimailOrigSrc = rawSrc;
    }

    const onLoad = () => markIfZoomable(img);
    const onError = () => showFallbackCard(img, opts, cleanups);
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    cleanups.push(() => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    });

    if (img.hasAttribute("data-omnimail-cid-missing")) {
      showFallbackCard(img, opts, cleanups);
    } else if (img.complete && rawSrc) {
      if (img.naturalWidth > 0) {
        markIfZoomable(img);
      } else {
        showFallbackCard(img, opts, cleanups);
      }
    }
  }

  const onClick = (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    if (!target || target.tagName !== "IMG") return;
    const clickedImg = target as HTMLImageElement;
    if (isInsideLink(clickedImg)) return;
    if (clickedImg.getAttribute("data-zoomable") !== "true") return;
    if (!opts.onOpenImage) return;

    ev.preventDefault();
    ev.stopPropagation();

    const zoomables = Array.from(
      root.querySelectorAll<HTMLImageElement>('img[data-zoomable="true"]'),
    );
    const items: LightboxImageItem[] = [];
    let clickedIndex = 0;

    zoomables.forEach((img, idx) => {
      const src = img.getAttribute("src")?.trim() ?? "";
      if (!src) return;
      if (img === clickedImg) clickedIndex = items.length;
      const attId = extractAttachmentIdFromSrc(
        img.dataset.omnimailOrigSrc || src,
        img.getAttribute("data-omnimail-cid"),
      );
      items.push({
        id: `dom-img-${idx}`,
        src,
        name: inferImageNameFromSrc(
          src,
          img.getAttribute("alt"),
          `${opts.defaultImageName} ${idx + 1}`,
        ),
        sourceLabel: opts.bodySourceLabel,
        attachmentId: attId,
        width: img.naturalWidth || undefined,
        height: img.naturalHeight || undefined,
      });
    });

    if (items.length > 0) {
      opts.onOpenImage(items, clickedIndex);
    }
  };

  root.addEventListener("click", onClick);
  cleanups.push(() => root.removeEventListener("click", onClick));
  return () => cleanups.forEach((fn) => fn());
}

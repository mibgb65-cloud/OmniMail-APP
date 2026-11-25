import { useEffect, useLayoutEffect, useRef } from "react";
import { useI18n } from "../../../i18n";
import { openSafeExternalUrl } from "../../../state/desktopActions";
import scrollbarReset from "../../../styles/scrollbar-reset.css?raw";
import type { DarkHtmlMode, ThemeMode } from "../../../types/settings";
import type { LightboxImageItem } from "../../../types/ui";
import {
  createBodyTranslationRenderer,
  type BodyTranslation,
} from "../translation/translatedText";
import { attachShadowImageEnhancements } from "./safeMailHtmlImages";
import { getMailHtmlThemeCss, SHADOW_BASE_CSS } from "./safeMailHtmlStyles";

export function SafeMailHtmlView({
  html,
  theme = "light",
  htmlThemeMode = "adaptive",
  onMailto,
  onExternalLink,
  onOpenImage,
  onRetryInlineCid,
  translation,
}: {
  html: string;
  theme?: ThemeMode;
  htmlThemeMode?: DarkHtmlMode;
  onMailto?: (mailtoUrl: string) => void;
  onExternalLink?: (payload: { url: string; displayText: string }) => void;
  onOpenImage?: (images: LightboxImageItem[], activeIndex: number) => void;
  onRetryInlineCid?: (attachmentId: string) => Promise<void>;
  translation?: BodyTranslation;
}) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renderTranslation = useRef<ReturnType<
    typeof createBodyTranslationRenderer
  > | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${scrollbarReset}\n${SHADOW_BASE_CSS}</style><div class="mail-html-inner">${html}</div><style class="omnimail-theme-style"></style>`;
    renderTranslation.current = null;
  }, [html]);

  useLayoutEffect(() => {
    // 切换深色适配 / 原始白底只更新独立主题样式节点，绝不重建 DOM、重载图片或破坏译文。
    const root = hostRef.current?.shadowRoot;
    if (!root) return;
    const themeStyle = root.querySelector<HTMLStyleElement>(
      "style.omnimail-theme-style",
    );
    if (themeStyle) {
      themeStyle.textContent = getMailHtmlThemeCss(theme, htmlThemeMode);
    }
    const inner = root.querySelector<HTMLElement>(".mail-html-inner");
    if (inner) {
      inner.dataset.theme = theme;
      inner.dataset.htmlMode = htmlThemeMode;
    }
  }, [html, theme, htmlThemeMode]);

  useEffect(() => {
    const root = hostRef.current?.shadowRoot;
    if (!root) return;
    const onClick = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href")?.trim() ?? "";
      ev.preventDefault();
      ev.stopPropagation();
      if (!href) return;
      if (href.toLowerCase().startsWith("mailto:") && onMailto) {
        onMailto(href);
        return;
      }
      if (/^https?:\/\//i.test(href)) {
        if (onExternalLink) {
          onExternalLink({
            url: href,
            displayText: anchor.textContent?.trim() ?? "",
          });
        } else {
          void openSafeExternalUrl(href);
        }
      }
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [onMailto, onExternalLink]);

  useEffect(() => {
    const root = hostRef.current?.shadowRoot;
    if (!root) return;
    return attachShadowImageEnhancements(root, {
      fallbackText: t("imageLightbox.inlineImageFallbackText"),
      retryLabel: t("imageLightbox.inlineImageRetryBtn"),
      retryingLabel: t("imageLightbox.inlineImageRetrying"),
      defaultImageName: t("imageLightbox.inlineImageDefaultName"),
      bodySourceLabel: t("imageLightbox.sourceInlineBody"),
      onOpenImage,
      onRetryInlineCid,
    });
  }, [html, onOpenImage, onRetryInlineCid, t]);

  useLayoutEffect(() => {
    // 切换模式或接收新批次只改已有文字节点，不重新加载图片或替换原有结构。
    if (translation && !renderTranslation.current) {
      const inner =
        hostRef.current?.shadowRoot?.querySelector<HTMLElement>(
          ".mail-html-inner",
        );
      if (inner)
        renderTranslation.current = createBodyTranslationRenderer(inner);
    }
    renderTranslation.current?.(translation);
  }, [html, translation]);

  return <div ref={hostRef} />;
}

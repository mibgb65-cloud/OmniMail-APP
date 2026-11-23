import { useEffect, useRef } from "react";
import { openSafeExternalUrl } from "../../../state/desktopActions";
import scrollbarReset from "../../../styles/scrollbar-reset.css?raw";
import {
  applyBodyTranslation,
  type BodyTranslation,
} from "../translation/translatedText";

const SHADOW_RESET_CSS = `
:host {
  display: block;
  font-size: 13.5px;
  line-height: 1.72;
  color: inherit;
  word-break: break-word;
  overflow-x: auto;
}
img { max-width: 100%; height: auto; border-radius: 6px; }
a { color: #2563eb; text-decoration: underline; }
blockquote {
  margin: 8px 0;
  padding-left: 12px;
  border-left: 3px solid rgba(100, 116, 139, 0.35);
  opacity: 0.88;
}
table { max-width: 100%; border-collapse: collapse; }
pre, code { white-space: pre-wrap; word-break: break-all; }
.omnimail-bilingual-text { opacity: .8; }
:is(p,li,h1,h2,h3,h4,td,th) > .omnimail-bilingual-text { display: block; margin-block: .18em; }
`;

export function SafeMailHtmlView({
  html,
  onMailto,
  translation,
}: {
  html: string;
  onMailto?: (mailtoUrl: string) => void;
  translation?: BodyTranslation;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${scrollbarReset}\n${SHADOW_RESET_CSS}</style><div class="mail-html-inner">${html}</div>`;
  }, [html]);

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
        void openSafeExternalUrl(href);
      }
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [onMailto]);

  useEffect(() => {
    const inner =
      hostRef.current?.shadowRoot?.querySelector<HTMLElement>(
        ".mail-html-inner",
      );
    // 切换阅读模式只改已有文字节点，不重新加载图片或替换原有结构。
    if (inner && translation) return applyBodyTranslation(inner, translation);
  }, [html, translation]);

  return <div ref={hostRef} />;
}

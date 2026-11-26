import type { DarkHtmlMode, ThemeMode } from "../../../types/settings.ts";

export const SHADOW_BASE_CSS = `
:host {
  display: block;
  font-size: 13.5px;
  line-height: 1.72;
  color: inherit;
  overflow-wrap: break-word;
  word-break: normal;
  overflow-x: auto;
}
.mail-html-inner {
  box-sizing: border-box;
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease, padding 160ms ease;
}
img { max-width: 100%; height: auto; border-radius: 6px; }
img[data-zoomable="true"] {
  cursor: zoom-in;
  transition: outline-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  outline: 2px solid transparent;
  outline-offset: 2px;
}
img[data-zoomable="true"]:hover {
  outline-color: rgba(59, 130, 246, 0.58);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.14);
}
.omnimail-img-fallback {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin: 6px 0;
  border-radius: 10px;
  border: 1px dashed rgba(100, 116, 139, 0.42);
  background: rgba(241, 245, 249, 0.78);
  color: #475569;
  font-size: 12.5px;
  line-height: 1.4;
  max-width: 100%;
}
.omnimail-img-fallback-icon {
  display: inline-flex;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  align-items: center;
  justify-content: center;
  background: rgba(148, 163, 184, 0.2);
  color: #64748b;
  flex-shrink: 0;
}
.omnimail-img-retry-btn {
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid rgba(59, 130, 246, 0.35);
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}
.omnimail-img-retry-btn:hover { background: rgba(37, 99, 235, 0.16); }
.omnimail-img-retry-btn:disabled { opacity: 0.6; cursor: wait; }
.mail-html-inner[data-theme="dark"][data-html-mode="adaptive"] .omnimail-img-fallback {
  background: #182030 !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
}
.mail-html-inner[data-theme="dark"][data-html-mode="adaptive"] .omnimail-img-fallback-icon {
  background: rgba(148, 163, 184, 0.14) !important;
  color: #94a3b8 !important;
}
.mail-html-inner[data-theme="dark"][data-html-mode="adaptive"] .omnimail-img-retry-btn {
  background: rgba(59, 130, 246, 0.16) !important;
  border-color: rgba(96, 165, 250, 0.4) !important;
  color: #93c5fd !important;
}
a { color: #2563eb; text-decoration: underline; }
blockquote {
  margin: 8px 0;
  padding-left: 12px;
  border-left: 3px solid rgba(100, 116, 139, 0.35);
  opacity: 0.88;
}
table { max-width: 100%; border-collapse: collapse; }
table, th, td { word-break: normal; overflow-wrap: normal; }
pre, code { white-space: pre-wrap; word-break: break-all; }
.omnimail-bilingual-text { opacity: .8; }
:is(p,li,h1,h2,h3,h4,td,th) > .omnimail-bilingual-text { display: block; margin-block: .18em; }
@media (prefers-reduced-motion: reduce) {
  .mail-html-inner, img[data-zoomable="true"] { transition: none; }
}
`;

export const SHADOW_DARK_ADAPTIVE_CSS = `
:host {
  color: #E2E8F0;
  color-scheme: dark;
}
.mail-html-inner {
  background: transparent !important;
  background-color: transparent !important;
  color: #E2E8F0 !important;
  color-scheme: dark;
}
.mail-html-inner :where(table, tr, p, div, span, li, td, th, font, blockquote, h1, h2, h3, h4, h5, h6) {
  border-color: #293548;
}
.mail-html-inner :where([bgcolor], [style*="background:#fff" i], [style*="background: #fff" i], [style*="background-color:#fff" i], [style*="background-color: #fff" i], [style*="background:white" i], [style*="background: white" i], [style*="background-color:white" i], [style*="background-color: white" i], [style*="rgb(255" i], [style*="rgb(250" i], [style*="rgb(248" i], [style*="rgb(245" i], [style*="rgb(244" i], [style*="rgb(242" i], [style*="rgb(240" i], [style*="background:#f" i], [style*="background: #f" i], [style*="background-color:#f" i], [style*="background-color: #f" i]) {
  background: #182030 !important;
  background-color: #182030 !important;
  color: #E2E8F0 !important;
}
.mail-html-inner :where([color], [style*="color:#0" i], [style*="color: #0" i], [style*="color:#1" i], [style*="color: #1" i], [style*="color:#2" i], [style*="color: #2" i], [style*="color:#3" i], [style*="color: #3" i], [style*="color:#4" i], [style*="color: #4" i], [style*="color:black" i], [style*="color: black" i], [style*="color:rgb(0" i], [style*="color: rgb(0" i], [style*="color:rgb(1" i], [style*="color: rgb(1" i], [style*="color:rgb(2" i], [style*="color: rgb(2" i], [style*="color:rgb(3" i], [style*="color: rgb(3" i], [style*="color:rgb(4" i], [style*="color: rgb(4" i], [style*="color:rgb(5" i], [style*="color: rgb(5" i]) {
  color: #E2E8F0 !important;
}
.mail-html-inner a:not([style*="color:#fff" i]):not([style*="color: #fff" i]):not([style*="color:white" i]):not([style*="color: white" i]):not([style*="rgb(255" i]) {
  color: #60A5FA !important;
}
.mail-html-inner hr {
  border-color: #293548;
}
.mail-html-inner pre,
.mail-html-inner code {
  background-color: #0F141D !important;
  color: #E2E8F0 !important;
}
/* 严禁对媒体与矢量图形反色，防止品牌 Logo、照片与图表失真 */
.mail-html-inner :where(img, video, svg, canvas) {
  filter: none !important;
}
`;

export const SHADOW_DARK_PAPER_CSS = `
:host {
  color-scheme: light;
}
.mail-html-inner {
  background: #FAFBFD;
  color: #0F172A;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #334155;
  color-scheme: light;
}
.mail-html-inner a {
  color: #2563EB;
}
`;

export const SHADOW_LIGHT_CSS = `
:host, .mail-html-inner {
  color-scheme: light;
}
`;

export function getMailHtmlThemeCss(
  theme: ThemeMode,
  htmlThemeMode: DarkHtmlMode,
): string {
  if (theme !== "dark") return SHADOW_LIGHT_CSS;
  return htmlThemeMode === "paper"
    ? SHADOW_DARK_PAPER_CSS
    : SHADOW_DARK_ADAPTIVE_CSS;
}

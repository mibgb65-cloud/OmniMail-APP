import type { ImagePolicy } from '../preferences/mailImages';

export function safeMailURL(value: string, image = false): string | undefined {
  if (
    !value ||
    value.length > 4096 ||
    Array.from(value).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  )
    return;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if (url.username || url.password) return;
    if (!image && url.protocol === 'mailto:') return url.href;
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return;
    if (image && /^(localhost|127(?:\.\d+){3}|\[::1\])$/i.test(url.hostname)) return;
    return url.href;
  } catch {
    return;
  }
}

export function buildMailDocument(html: string, policy: ImagePolicy) {
  // Template 内容保持 inert，先处理资源再放进 iframe，不在解析阶段请求邮件图片。
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content
    .querySelectorAll(
      'script,style,iframe,object,embed,form,input,button,link,meta,base,svg,math,video,audio,source',
    )
    .forEach((node) => node.remove());
  let blocked = 0;
  let unavailable = 0;
  template.content.querySelectorAll('*').forEach((node) => {
    // 邮件中任何嵌套 title 都可能覆盖链接的统一提示，不能只清理最外层 a。
    node.removeAttribute('title');
    node.removeAttribute('id');
    if (node instanceof HTMLElement) {
      // 颜色值仍原样保留，仅降下邮件自身的 !important，让受控暗色规则可覆盖；
      // 原始配色模式不匹配暗色规则，仍使用这些原始颜色。
      for (const property of ['color', 'background-color', 'border-color']) {
        if (node.style.getPropertyPriority(property)) {
          const value = node.style.getPropertyValue(property);
          node.style.removeProperty(property);
          node.style.setProperty(property, value);
        }
      }
      for (const property of Array.from(node.style)) {
        if (/(?:\d|\.)\s*(?:[sld]?v[hw]|vmin|vmax)\b/i.test(node.style.getPropertyValue(property)))
          node.style.removeProperty(property);
      }
    }
    for (const attr of [...node.attributes]) {
      if (
        /^on/i.test(attr.name) ||
        ['src', 'srcset', 'href', 'target', 'ping', 'download', 'poster', 'background'].includes(
          attr.name,
        )
      )
        node.removeAttribute(attr.name);
    }
    if (node.tagName === 'IMG') {
      const embedded = node.getAttribute('data-mail-image') ?? '';
      const remote = safeMailURL(node.getAttribute('data-mail-remote') ?? '', true);
      const data = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(embedded)
        ? embedded
        : undefined;
      const source = data ?? remote;
      if (!source) unavailable++;
      else if (policy === 'none' || (!data && policy !== 'all')) blocked++;
      else node.setAttribute('src', source);
      node.setAttribute('referrerpolicy', 'no-referrer');
      if (!node.getAttribute('alt')) node.setAttribute('alt', '▧');
      node.removeAttribute('data-mail-image');
      node.removeAttribute('data-mail-remote');
    }
    if (node.tagName === 'A') {
      node.removeAttribute('title');
      const target = safeMailURL(node.getAttribute('data-mail-url') ?? '');
      if (target) {
        node.setAttribute('href', '#omnimail-link');
        node.setAttribute(
          'data-tooltip',
          target.length > 1024 ? `${target.slice(0, 1023)}…` : target,
        );
        node.setAttribute('data-tooltip-kind', 'link');
        node.setAttribute('aria-label', `${node.textContent ?? ''} — ${target}`);
      } else node.removeAttribute('data-mail-url');
    }
  });
  const images = policy === 'all' ? 'data: https: http:' : policy === 'inline' ? 'data:' : "'none'";
  const csp = `default-src 'none'; script-src 'none'; img-src ${images}; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`;
  const source = `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><style>
html{color-scheme:light}html,body{overflow:hidden!important;scrollbar-width:none!important}body{margin:0;font:14px/1.65 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:#202023;background:#fff;overflow-wrap:anywhere}*::-webkit-scrollbar{display:none!important}#omnimail-layout{box-sizing:border-box;padding:16px;overflow:hidden}#omnimail-content{display:flow-root;min-width:0;transform-origin:top left}#omnimail-content div,#omnimail-content table{box-sizing:border-box;max-width:100%!important}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}a{color:#185abc}img:not([src]){display:inline-block;min-width:24px;min-height:24px;border:1px dashed #c4c4cc}
html[data-mail-theme="dark"]:not([data-mail-original="true"]){color-scheme:dark}
html[data-mail-theme="dark"]:not([data-mail-original="true"]) body{background:#242428!important;color:#e7e7ec!important}
html[data-mail-theme="dark"]:not([data-mail-original="true"]) #omnimail-content,
html[data-mail-theme="dark"]:not([data-mail-original="true"]) #omnimail-content *{color:#e7e7ec!important;background-color:transparent!important;border-color:#51515c!important;box-shadow:none!important;text-shadow:none!important}
html[data-mail-theme="dark"]:not([data-mail-original="true"]) #omnimail-content a,
html[data-mail-theme="dark"]:not([data-mail-original="true"]) #omnimail-content a *{color:#9fc4ff!important}
</style></head><body><div id="omnimail-layout"><div id="omnimail-content">${template.innerHTML}</div></div></body></html>`;
  return { source, blocked, unavailable };
}

import { expect, it } from 'vitest';
import { buildMailDocument } from './mailDocument';

const image = 'data:image/png;base64,aGVsbG8=';
const html = `<p>富文本</p><img data-mail-image="${image}"><img data-mail-remote="https://images.example.invalid/a.png"><a href="#omnimail-link" data-mail-url="https://example.invalid">外链</a>`;

it('默认图片策略仅激活内嵌图，远程引用保持惰性，沙箱文档携带严格 CSP', () => {
  const result = buildMailDocument(html, 'inline');
  const doc = new DOMParser().parseFromString(result.source, 'text/html');
  const images = doc.querySelectorAll('img');
  expect(images[0]?.getAttribute('src')).toBe(image);
  expect(images[1]?.hasAttribute('src')).toBe(false);
  expect(result.blocked).toBe(1);
  expect(
    doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'),
  ).toContain("default-src 'none'");
  expect(result.source).not.toContain('img-src data: https: http:');
});

it('不显示和全部显示遵守图片策略，不放开 CSS 或脚本', () => {
  const none = buildMailDocument(html, 'none');
  expect(
    new DOMParser().parseFromString(none.source, 'text/html').querySelectorAll('img[src]'),
  ).toHaveLength(0);
  expect(none.blocked).toBe(2);
  const all = buildMailDocument(html, 'all');
  expect(
    new DOMParser().parseFromString(all.source, 'text/html').querySelectorAll('img[src]'),
  ).toHaveLength(2);
  expect(all.source).toContain("script-src 'none'");
  expect(all.source).toContain("connect-src 'none'");
});

it('不激活不支持的 data 图片和伪造外链协议，也不保留 srcset 或主动原始 src', () => {
  const result = buildMailDocument(
    `<img src="https://forged.invalid" srcset="https://forged.invalid/2" data-mail-image="data:image/svg+xml;base64,abc">
    <img data-mail-remote="file:///secret"><a href="javascript:alert(1)" data-mail-url="javascript:alert(1)">坏链接</a>`,
    'all',
  );
  const doc = new DOMParser().parseFromString(result.source, 'text/html');
  expect(doc.querySelector('img[src], img[srcset], a[href]')).toBeNull();
});
it('邮件链接不保留原生黑色 title，提供真实地址的统一提示', () => {
  const result = buildMailDocument(
    '<a title="伪装地址" data-mail-url="https://example.invalid/path"><span title="嵌套原生提示">访问</span></a>',
    'inline',
  );
  const link = new DOMParser().parseFromString(result.source, 'text/html').querySelector('a');
  expect(link?.hasAttribute('title')).toBe(false);
  expect(link?.getAttribute('data-tooltip')).toBe('https://example.invalid/path');
  expect(link?.getAttribute('data-tooltip-kind')).toBe('link');
  expect(link?.querySelector('[title]')).toBeNull();
});

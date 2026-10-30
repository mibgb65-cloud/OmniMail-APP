import { Browser, System } from '@wailsio/runtime';
import { expect, it, vi } from 'vitest';
import { openMailLink } from './links';

vi.mock('@wailsio/runtime', () => ({
  Browser: { OpenURL: vi.fn().mockResolvedValue(undefined) },
  System: { IsDesktop: vi.fn(() => true) },
}));

it('只有合法 HTTP/HTTPS/mailto 可交系统打开，拒绝本地执行与携带凭据 URL', async () => {
  for (const url of [
    'javascript:alert(1)',
    'file:///secret',
    'data:text/html,test',
    'https://user:secret@example.invalid',
    'https://example.invalid/\n',
  ]) {
    await expect(openMailLink(url)).rejects.toThrow('LINK_UNAVAILABLE');
  }
  expect(Browser.OpenURL).not.toHaveBeenCalled();
  await openMailLink('https://example.invalid/path');
  expect(Browser.OpenURL).toHaveBeenCalledExactlyOnceWith('https://example.invalid/path');
});

it('原生异常不会作为邮件正文错误泄露，浏览器预览不调用系统 API', async () => {
  vi.mocked(Browser.OpenURL).mockRejectedValueOnce(new Error('private backend path'));
  await expect(openMailLink('mailto:reader@example.invalid')).rejects.toThrow('LINK_UNAVAILABLE');
  vi.mocked(System.IsDesktop).mockReturnValue(false);
  vi.mocked(Browser.OpenURL).mockClear();
  await expect(openMailLink('https://example.invalid')).rejects.toThrow('LINK_UNAVAILABLE');
  expect(Browser.OpenURL).not.toHaveBeenCalled();
});

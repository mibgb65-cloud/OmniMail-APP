import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { setImagePolicy } from '../lib/preferences/mailImages';
import { MailBody } from './MailBody';
import { SettingsMailImages } from '../components/SettingsDialog/SettingsMailImages';
import { openMailLink } from '../lib/bridge/links';
import { attachMailFrame } from '../lib/mail/mailFrame';

vi.mock('../lib/bridge/links', () => ({ openMailLink: vi.fn().mockResolvedValue(undefined) }));
const html = '<h2>完整排版</h2><img data-mail-remote="https://images.example.invalid/banner.png">';
beforeEach(() => localStorage.clear());

it('富正文在无脚本沙箱显示，设置即时联动，切换邮件不继承临时图片许可', () => {
  const content = (id: string) => (
    <I18nProvider initialLocale="zh-CN">
      <SettingsMailImages />
      <MailBody id={id} html={html} text="回退" />
    </I18nProvider>
  );
  const view = render(content('first'));
  const frame = () => screen.getByTitle('邮件正文');
  expect(frame()).toHaveAttribute('sandbox', 'allow-same-origin');
  expect(frame()).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(frame().getAttribute('srcdoc')).toContain('完整排版');
  expect(frame().getAttribute('srcdoc')).not.toContain('src="https:');
  fireEvent.click(screen.getByRole('button', { name: '仅本封显示图片' }));
  expect(frame().getAttribute('srcdoc')).toContain('src="https:');
  view.rerender(content('second'));
  expect(frame().getAttribute('srcdoc')).not.toContain('src="https:');
  fireEvent.click(screen.getByRole('radio', { name: '显示全部图片（包含外链图片）' }));
  expect(frame().getAttribute('srcdoc')).toContain('src="https:');
  fireEvent.click(screen.getByRole('radio', { name: '不显示图片' }));
  expect(frame().getAttribute('srcdoc')).not.toContain('src="https:');
});

it('纯文本安全回退，不注入脚本；非法存储偏好不自动开启图片', () => {
  localStorage.setItem('omnimail.mailImages', 'untrusted');
  render(
    <I18nProvider initialLocale="en">
      <MailBody id="plain" text="<script>bad()</script>" />
    </I18nProvider>,
  );
  expect(screen.getByText('<script>bad()</script>')).toBeVisible();
  expect(document.querySelector('script,iframe')).toBeNull();
  act(() => {
    setImagePolicy('inline');
  });
});

it('点击真实阅读器链接先确认，切换邮件会取消未确认目标而不打开', () => {
  vi.mocked(openMailLink).mockClear();
  const content = (id: string) => (
    <I18nProvider initialLocale="zh-CN">
      <MailBody
        id={id}
        html={'<a data-mail-url="https://example.invalid/path">访问页面</a>'}
        text="回退"
      />
    </I18nProvider>
  );
  const view = render(content('first'));
  const frame = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('测试 iframe 不可用');
  doc.body.innerHTML =
    '<a href="#omnimail-link" data-mail-url="https://example.invalid/path">访问页面</a>';
  fireEvent.load(frame);
  const link = doc.querySelector('a');
  if (!link) throw new Error('链接缺失');
  fireEvent.click(link);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('打开邮件中的链接？');
  expect(openMailLink).not.toHaveBeenCalled();
  view.rerender(content('second'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(openMailLink).not.toHaveBeenCalled();
});

it('iframe 链接由父应用拦截，点击和中键都不在邮件内导航，卸载移除监听', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) throw new Error('测试 iframe 不可用');
  doc.body.innerHTML =
    '<a href="#omnimail-link" data-mail-url="https://example.invalid"><span>链接</span></a>';
  const close = attachMailFrame(frame, (value) => {
    void openMailLink(value);
  });
  const target = doc.querySelector('span');
  if (!target) throw new Error('链接缺失');
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(openMailLink).toHaveBeenCalledWith('https://example.invalid');
  close();
  vi.mocked(openMailLink).mockClear();
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(openMailLink).not.toHaveBeenCalled();
  frame.remove();
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import { setImagePolicy } from '../lib/preferences/mailImages';
import { MailBody } from './MailBody';
import { SettingsMailImages } from '../components/SettingsDialog/SettingsMailImages';
import { openMailLink } from '../lib/bridge/links';
import { attachMailFrame } from '../lib/mail/mailFrame';
import { SettingsMailAppearance } from '../components/SettingsDialog/SettingsMailAppearance';

vi.mock('../lib/bridge/links', () => ({ openMailLink: vi.fn().mockResolvedValue(undefined) }));
const html = '<h2>完整排版</h2><img data-mail-remote="https://images.example.invalid/banner.png">';
beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

it('阅读区不再显示每封邮件的原始配色切换按钮', () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailBody id="no-colors-button" html="<p>正文</p>" text="正文" />
    </I18nProvider>,
  );
  expect(screen.queryByRole('button', { name: '查看原始配色' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '跟随应用配色' })).not.toBeInTheDocument();
});

it('设置改变实时应用到当前及新邮件，不重建 iframe、srcDoc 或图片权限', async () => {
  document.documentElement.dataset.theme = 'dark';
  const content = (id: string) => (
    <I18nProvider initialLocale="zh-CN">
      <SettingsMailAppearance />
      <MailBody id={id} html={html} text="回退" />
    </I18nProvider>
  );
  const view = render(content('first'));
  const frame = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  const source = frame.srcdoc;
  const close = attachMailFrame(frame, vi.fn());
  expect(frame).toHaveAttribute('data-original', 'false');
  fireEvent.click(screen.getByRole('switch', { name: '邮件正文跟随暗色模式' }));
  await waitFor(() =>
    expect(frame.contentDocument?.documentElement.dataset.mailOriginal).toBe('true'),
  );
  expect(screen.getByTitle('邮件正文')).toBe(frame);
  expect(frame.srcdoc).toBe(source);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('omnimail.mailImages')).toBeNull();
  close();
  view.rerender(content('second'));
  expect(screen.getByTitle('邮件正文')).toHaveAttribute('data-original', 'true');
  fireEvent.click(screen.getByRole('switch', { name: '邮件正文跟随暗色模式' }));
  expect(screen.getByTitle('邮件正文')).toHaveAttribute('data-original', 'false');
  delete document.documentElement.dataset.theme;
});

it('纯文本按有限自然段提供入场目标，原文换行和大正文不丢失', () => {
  const text = Array.from({ length: 100 }, (_, i) => `第 ${i} 段\r\n正文内容`).join('\r\n\r\n');
  const { container } = render(
    <I18nProvider initialLocale="zh-CN">
      <MailBody id="bounded" text={text} transitionManaged />
    </I18nProvider>,
  );
  const parts = container.querySelectorAll('[data-mail-reveal]');
  expect(parts.length).toBeLessThanOrEqual(16);
  expect(parts[0]?.parentElement?.textContent).toBe(text);
  expect(container.querySelector('[data-animate="true"]')).toBeNull();
});

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

it('点击真实阅读器链接先确认，切换邮件会取消未确认目标而不打开', async () => {
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
    '<div id="omnimail-content"><a href="#omnimail-link" data-mail-url="https://example.invalid/path">访问页面</a></div>';
  fireEvent.load(frame);
  const link = doc.querySelector('a');
  if (!link) throw new Error('链接缺失');
  await waitFor(() => expect(frame).toHaveAttribute('aria-hidden', 'false'));
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
it('文档准备时显示骨架并隐藏半成品，load 测量结束后才显示正文', async () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailBody id="loading" html="<p>正文</p>" text="回退" />
    </I18nProvider>,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
  expect(frame).toHaveAttribute('aria-hidden', 'true');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('文档缺失');
  doc.body.innerHTML = '<div id="omnimail-content">正文</div>';
  Object.defineProperty(frame, 'clientWidth', { value: 640, configurable: true });
  const content = doc.getElementById('omnimail-content');
  Object.defineProperty(content, 'scrollHeight', { value: 400, configurable: true });
  fireEvent.load(frame);
  await waitFor(() => expect(frame).toHaveAttribute('aria-hidden', 'false'));
  expect(screen.queryByRole('status', { name: '正在加载邮件内容' })).not.toBeInTheDocument();
  fireEvent.load(frame);
  expect(frame).toHaveAttribute('aria-hidden', 'false');
});

it('同封邮件更新文档时重建 iframe，旧图片迟到回调不能揭开新文档', async () => {
  const content = (html: string) => (
    <I18nProvider initialLocale="zh-CN">
      <MailBody id="same" html={html} text="回退" />
    </I18nProvider>
  );
  const view = render(content('<p>旧文档</p>'));
  const old = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  const doc = old.contentDocument;
  if (!doc) throw new Error('文档缺失');
  doc.body.innerHTML =
    '<div id="omnimail-content"><img src="https://images.example.invalid/late.png"></div>';
  let finish: () => void = () => {};
  const decode = new Promise<void>((resolve) => {
    finish = resolve;
  });
  Object.defineProperty(doc.images[0], 'decode', { value: () => decode });
  fireEvent.load(old);
  view.rerender(content('<p>新文档</p>'));
  const fresh = screen.getByTitle('邮件正文');
  expect(fresh).not.toBe(old);
  await act(async () => finish());
  expect(fresh).toHaveAttribute('aria-hidden', 'true');
});

it('慢图片不自动揭开半成品，用户可主动先阅读且切换邮件不继承就绪状态', async () => {
  vi.useFakeTimers();
  const content = (id: string) => (
    <I18nProvider initialLocale="zh-CN">
      <MailBody id={id} html="<p>正文</p>" text="纯文本" />
    </I18nProvider>
  );
  const view = render(content('slow'));
  const frame = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('文档缺失');
  doc.body.innerHTML =
    '<div id="omnimail-content">正文<img src="https://images.example.invalid/slow.png"></div>';
  let decoded: () => void = () => {};
  const pendingDecode = new Promise<void>((resolve) => {
    decoded = resolve;
  });
  Object.defineProperty(doc.images[0], 'decode', { value: () => pendingDecode });
  Object.defineProperty(frame, 'clientWidth', { value: 640 });
  await act(async () => vi.advanceTimersByTimeAsync(12000));
  expect(frame).toHaveAttribute('aria-hidden', 'true');
  fireEvent.click(screen.getByRole('button', { name: '先阅读正文' }));
  await act(async () => vi.advanceTimersByTimeAsync(60));
  expect(frame).toHaveAttribute('aria-hidden', 'false');
  view.rerender(content('other'));
  await act(async () => decoded());
  expect(screen.getByTitle('邮件正文')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
});

it('超大布局明确降级并保留全部文本，不隐藏裁掉剩余内容', async () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailBody id="huge" html="<p>巨大布局</p>" text="所有正文均保留" />
    </I18nProvider>,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('文档缺失');
  doc.body.innerHTML = '<div id="omnimail-content">巨大布局</div>';
  Object.defineProperty(frame, 'clientWidth', { value: 640 });
  Object.defineProperty(doc.getElementById('omnimail-content'), 'scrollHeight', { value: 50000 });
  fireEvent.load(frame);
  expect(await screen.findByText('所有正文均保留')).toBeVisible();
  expect(screen.getByText(/邮件版式过大/)).toBeVisible();
  expect(screen.queryByTitle('邮件正文')).not.toBeInTheDocument();
});
it('文档 A 到 B 再回到 A 也重新准备，不复用旧就绪标记', async () => {
  const content = (html: string) => (
    <I18nProvider initialLocale="zh-CN">
      <MailBody id="same" html={html} text="回退" />
    </I18nProvider>
  );
  const view = render(content('<p>A</p>'));
  const frame = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('文档缺失');
  doc.body.innerHTML = '<div id="omnimail-content">A</div>';
  Object.defineProperty(frame, 'clientWidth', { value: 640 });
  fireEvent.load(frame);
  await waitFor(() => expect(frame).toHaveAttribute('aria-hidden', 'false'));
  view.rerender(content('<p>B</p>'));
  view.rerender(content('<p>A</p>'));
  expect(screen.getByTitle('邮件正文')).toHaveAttribute('aria-hidden', 'true');
});
it('保留为旧过渡页时关闭链接确认并阻止再次激活，不重建已准备文档', async () => {
  const content = (interactive: boolean) => (
    <I18nProvider initialLocale="zh-CN">
      <MailBody
        id="same"
        html='<a data-mail-url="https://example.invalid">链接</a>'
        text="回退"
        interactive={interactive}
      />
    </I18nProvider>
  );
  const view = render(content(true));
  const frame = screen.getByTitle<HTMLIFrameElement>('邮件正文');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('文档缺失');
  doc.body.innerHTML =
    '<div id="omnimail-content"><a href="#" data-mail-url="https://example.invalid">链接</a></div>';
  fireEvent.load(frame);
  await waitFor(() => expect(frame).toHaveAttribute('aria-hidden', 'false'));
  const link = doc.querySelector('a');
  if (!link) throw new Error('链接缺失');
  fireEvent.click(link);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  view.rerender(content(false));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTitle('邮件正文')).toBe(frame);
  fireEvent.click(link);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

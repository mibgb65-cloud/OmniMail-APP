import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getVersion } from '../lib/bridge/app';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import type { Locale } from '../lib/i18n/resources';
import { VERSION_INFO } from '../test/fixtures';
import { App } from './App';

vi.mock('../lib/bridge/app', () => ({ getVersion: vi.fn() }));

beforeEach(() => {
  vi.mocked(getVersion).mockReset();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

async function renderApp(locale: Locale = 'zh-CN') {
  const view = render(
    <I18nProvider initialLocale={locale}>
      <App />
    </I18nProvider>,
  );
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => {
    expect(
      screen.queryByRole('region', { name: /OmniMail 启动|OmniMail startup/ }),
    ).not.toBeInTheDocument();
  });
  return view;
}

function openAbout(locale: Locale = 'zh-CN') {
  fireEvent.click(screen.getByRole('button', { name: locale === 'en' ? 'Settings' : '设置' }));
  fireEvent.click(screen.getByRole('tab', { name: locale === 'en' ? 'About' : '关于' }));
}

function switchToolbarLanguage(locale: Locale) {
  const toolbar = within(screen.getByRole('banner', { name: /窗口操作栏|Window toolbar/ }));
  fireEvent.click(
    toolbar.getByRole('button', {
      name: locale === 'en' ? 'English' : '简体中文',
    }),
  );
}

describe('初始化工作台', () => {
  it('加载时提供状态反馈并禁用重复检查', async () => {
    vi.mocked(getVersion).mockReturnValue(new Promise(() => {}));
    await renderApp();
    expect(screen.queryByText('开发状态')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '全部收件箱' })).toBeVisible();
    openAbout();
    expect(screen.getByRole('status')).toHaveTextContent('正在连接 Go 服务');
    expect(screen.getByRole('button', { name: '正在检查…' })).toBeDisabled();
  });

  it('显示 Go 返回的真实版本信息', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    await renderApp();
    openAbout();
    expect(await screen.findByText('桌面服务已连接 · React ↔ Go')).toBeVisible();
    expect(screen.getByText(VERSION_INFO.version)).toBeVisible();
    expect(screen.getByText(VERSION_INFO.commit)).toBeVisible();
    expect(screen.getByText(VERSION_INFO.platform)).toBeVisible();
  });

  it('失败后可以重试，界面不显示底层敏感错误', async () => {
    vi.mocked(getVersion)
      .mockRejectedValueOnce(new Error('token=private-token'))
      .mockResolvedValueOnce(VERSION_INFO);
    await renderApp();
    openAbout();
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法连接桌面服务');
    expect(screen.queryByText(/private-token/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '检查连接' }));
    expect(await screen.findByText('桌面服务已连接 · React ↔ Go')).toBeVisible();
    expect(getVersion).toHaveBeenCalledTimes(2);
  });

  it('StrictMode 清理与卸载都会取消对应请求', () => {
    vi.mocked(getVersion).mockReturnValue(new Promise(() => {}));
    const view = render(
      <StrictMode>
        <I18nProvider initialLocale="zh-CN">
          <App />
        </I18nProvider>
      </StrictMode>,
    );
    const calls = vi.mocked(getVersion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]?.aborted).toBe(true);
    expect(calls[1]?.[0]?.aborted).toBe(false);
    view.unmount();
    expect(calls[1]?.[0]?.aborted).toBe(true);
  });
});

describe('工作台中英文适配', () => {
  it('切换导航、页面、连接面板和无障碍标签，不重建页面或重新请求 Go', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    await renderApp();
    const workspace = screen.getByRole('main');
    switchToolbarLanguage('en');
    expect(screen.getByRole('navigation', { name: 'Main features' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Skip to workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All inboxes' })).toBeVisible();
    openAbout('en');
    expect(screen.getByText('Your email workspace starts here.')).toBeVisible();
    expect(screen.getByText('Desktop service connected · React ↔ Go')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check connection' })).toBeEnabled();
    expect(screen.getByText('Build time')).toBeVisible();
    expect(screen.getByText(VERSION_INFO.commit)).toBeVisible();
    await waitFor(() => expect(screen.queryByText('全部收件箱')).not.toBeInTheDocument());
    expect(screen.getByRole('main')).toBe(workspace);
    expect(getVersion).toHaveBeenCalledOnce();
  });

  it('等待连接时也可切换语言，且保留当前请求', async () => {
    vi.mocked(getVersion).mockReturnValue(new Promise(() => {}));
    await renderApp();
    switchToolbarLanguage('en');
    openAbout('en');
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to the Go service');
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    expect(getVersion).toHaveBeenCalledOnce();
    expect(vi.mocked(getVersion).mock.calls[0]?.[0]?.aborted).toBe(false);
  });

  it('英文错误提示仍隐藏底层敏感信息且支持重试', async () => {
    vi.mocked(getVersion)
      .mockRejectedValueOnce(new Error('token=private-token'))
      .mockResolvedValueOnce(VERSION_INFO);
    await renderApp('en');
    openAbout('en');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect to the desktop service',
    );
    expect(screen.queryByText(/private-token/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    expect(await screen.findByText('Desktop service connected · React ↔ Go')).toBeVisible();
  });

  it('将未注入的构建信息显示为对应语言的未知值', async () => {
    vi.mocked(getVersion).mockResolvedValue({
      ...VERSION_INFO,
      commit: 'unknown',
      buildTime: 'unknown',
    });
    await renderApp();
    openAbout();
    expect(await screen.findAllByText('未知')).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: '通用设置' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('tab', { name: 'About' }));
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
  });
});

describe('工作台与开屏的衔接', () => {
  it('侧栏选择同步更新气泡标题，并随语言切换', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    await renderApp();
    expect(screen.getByRole('heading', { name: '全部收件箱' })).toBeVisible();
    const navigation = screen.getByRole('navigation');
    const starred = within(navigation).getByRole('button', { name: '星标邮件' });
    fireEvent.click(starred);
    expect(starred).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '星标邮件' })).toBeVisible();
    expect(screen.getByText('邮箱功能尚未接入，邮件将在这里显示。')).toBeVisible();
    switchToolbarLanguage('en');
    expect(screen.getByRole('heading', { name: 'Starred' })).toBeVisible();
    expect(within(navigation).getByRole('button', { name: 'Starred' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('设置悬浮窗与顶部操作栏共用语言、主题状态，且不重新连接 Go', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    await renderApp();
    const workspace = screen.getByRole('main');
    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    fireEvent.click(within(dialog).getByRole('tab', { name: '关于' }));
    const about = within(dialog).getByRole('tabpanel', { name: '关于' });
    expect(within(about).getByText(VERSION_INFO.version)).toBeVisible();
    expect(within(about).getByText(VERSION_INFO.commit)).toBeVisible();
    fireEvent.click(within(dialog).getByRole('tab', { name: '通用设置' }));
    fireEvent.click(within(dialog).getByRole('switch', { name: '深色模式' }));
    const toolbar = screen.getByRole('banner', { name: '窗口操作栏' });
    expect(within(toolbar).getByRole('button', { name: '深色模式' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'English' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBe(dialog);
    expect(within(toolbar).getByRole('group', { name: 'Change language' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(toolbar).getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('main')).toBe(workspace);
    expect(getVersion).toHaveBeenCalledOnce();
  });

  it('顶部品牌信息只保留在侧栏，操作栏仍保留语言与窗口操作', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    await renderApp();
    const sidebar = screen.getByRole('complementary', { name: '应用导航' });
    const toolbar = screen.getByRole('banner', { name: '窗口操作栏' });
    expect(within(sidebar).getByText('OmniMail')).toBeVisible();
    expect(within(sidebar).queryByText('桌面端')).not.toBeInTheDocument();
    expect(within(toolbar).queryByText('OmniMail')).not.toBeInTheDocument();
    expect(screen.queryByText('开发预览')).not.toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '简体中文' })).toBeEnabled();
    expect(within(toolbar).getByRole('button', { name: '深色模式' })).toBeEnabled();
    expect(within(toolbar).getByRole('button', { name: '关闭窗口' })).toBeInTheDocument();
  });

  it('开屏期间只显示窗口控制，退出后恢复语言与主题入口', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    render(
      <I18nProvider initialLocale="zh-CN">
        <App />
      </I18nProvider>,
    );
    const toolbar = screen.getByRole('banner', { name: '窗口操作栏' });
    expect(within(toolbar).getAllByRole('button')).toHaveLength(3);
    for (const name of ['最小化', '最大化', '关闭窗口']) {
      expect(within(toolbar).getByRole('button', { name })).toBeVisible();
    }
    expect(screen.queryByRole('group', { name: '切换语言' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '深色模式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '跳过动画' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '全部收件箱' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(screen.getByRole('button', { name: '简体中文' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '深色模式' })).toBeEnabled();
    expect(getVersion).toHaveBeenCalledOnce();
  });

  it('开屏期间工作台不参与导航，退出后焦点回到主内容', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    const view = render(
      <I18nProvider initialLocale="zh-CN">
        <App />
      </I18nProvider>,
    );
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(view.container.querySelector('[inert]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(view.container.querySelector('[inert]')).toBeNull();
  });

  it('重播不重建工作台、不重新连接 Go，且文案跟随语言切换', async () => {
    vi.mocked(getVersion).mockResolvedValue(VERSION_INFO);
    await renderApp();
    const workspace = screen.getByRole('main');
    switchToolbarLanguage('en');
    openAbout('en');
    fireEvent.click(screen.getByRole('button', { name: 'Replay intro' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your email workspace');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(screen.getByRole('main')).toBe(workspace);
    expect(getVersion).toHaveBeenCalledOnce();
  });
});

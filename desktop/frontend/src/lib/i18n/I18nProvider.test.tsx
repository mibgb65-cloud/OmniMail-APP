import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LanguageSwitcher } from '../../components/LanguageSwitcher/LanguageSwitcher';
import { I18nProvider } from './I18nProvider';
import { LOCALE_STORAGE_KEY } from './locale';
import type { Locale } from './resources';
import { useTranslation } from './useTranslation';

function ExamplePage() {
  const { t } = useTranslation('workspace');
  return <h1>{t('title')}</h1>;
}

function InvalidLocaleControl() {
  const { setLocale } = useTranslation('common');
  return (
    <button type="button" onClick={() => setLocale('fr' as Locale)}>
      Invalid locale
    </button>
  );
}

function renderExample() {
  return render(
    <I18nProvider>
      <LanguageSwitcher />
      <ExamplePage />
    </I18nProvider>,
  );
}

function chooseLanguage(locale: Locale, scope: Pick<typeof screen, 'getByRole'> = screen) {
  fireEvent.click(
    scope.getByRole('button', {
      name: locale === 'en' ? 'English' : '简体中文',
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('语言上下文与切换入口', () => {
  it('首次跟随系统语言但不自动保存偏好', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    renderExample();
    expect(screen.getByRole('heading')).toHaveTextContent('Your email workspace starts here.');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('同步页面描述，避免英语界面残留中文元信息', () => {
    const description = document.createElement('meta');
    description.name = 'description';
    document.head.append(description);
    try {
      renderExample();
      chooseLanguage('en');
      expect(description.content).toBe('OmniMail, a local-first desktop email client.');
      chooseLanguage('zh-CN');
      expect(description.content).toBe('OmniMail，本地优先的桌面邮件客户端。');
    } finally {
      description.remove();
    }
  });

  it('立即切换所有消费者，更新文档语言并在重新挂载后恢复偏好', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
    const view = renderExample();
    chooseLanguage('en');
    expect(screen.getByRole('heading')).toHaveTextContent('Your email workspace starts here.');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    view.unmount();
    renderExample();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    chooseLanguage('zh-CN');
    expect(screen.getByRole('heading')).toHaveTextContent('你的邮件工作台，从这里开始。');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('写入失败不影响当前会话的切换', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    renderExample();
    chooseLanguage('en');
    expect(screen.getByRole('heading')).toHaveTextContent('Your email workspace starts here.');
    expect(document.documentElement.lang).toBe('en');
  });

  it('胶囊仅提供受支持的语言，查看选项不会改变偏好', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
    renderExample();
    const capsule = screen.getByRole('group', { name: '切换语言' });
    fireEvent.mouseEnter(capsule);
    expect(within(capsule).getAllByRole('button')).toHaveLength(2);
    expect(within(capsule).queryByRole('button', { name: /fr|French/ })).not.toBeInTheDocument();
    fireEvent.mouseLeave(capsule);
    expect(screen.getByRole('heading')).toHaveTextContent('你的邮件工作台，从这里开始。');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('上下文拒绝绕过组件校验的非法语言', () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <InvalidLocaleControl />
        <ExamplePage />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invalid locale' }));
    expect(screen.getByRole('heading')).toHaveTextContent('你的邮件工作台，从这里开始。');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('非法初始语言安全回退且不自动保存偏好', () => {
    render(
      <I18nProvider initialLocale={'fr' as Locale}>
        <ExamplePage />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('你的邮件工作台，从这里开始。');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('存储访问被禁止时仍可启动和切换', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    renderExample();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    chooseLanguage('zh-CN');
    expect(screen.getByRole('heading')).toHaveTextContent('你的邮件工作台，从这里开始。');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('多个 Provider 的语言订阅互不污染', () => {
    render(
      <>
        <section aria-label="First workspace">
          <I18nProvider initialLocale="zh-CN">
            <LanguageSwitcher />
            <ExamplePage />
          </I18nProvider>
        </section>
        <section aria-label="Second workspace">
          <I18nProvider initialLocale="zh-CN">
            <LanguageSwitcher />
            <ExamplePage />
          </I18nProvider>
        </section>
      </>,
    );
    const first = within(screen.getByRole('region', { name: 'First workspace' }));
    const second = within(screen.getByRole('region', { name: 'Second workspace' }));
    chooseLanguage('en', first);
    expect(first.getByRole('heading')).toHaveTextContent('Your email workspace starts here.');
    expect(second.getByRole('heading')).toHaveTextContent('你的邮件工作台，从这里开始。');
    expect(second.getByRole('button', { name: '简体中文' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

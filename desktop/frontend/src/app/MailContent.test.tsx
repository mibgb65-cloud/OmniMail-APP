import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import type { MailController } from './useMail';
import { MailWorkspace } from './MailWorkspace';
import { MailList } from './MailList';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';

function makeController(overrides: Partial<MailController> = {}): MailController {
  const message = {
    id: 'mail-test',
    accountId: 'account-test',
    mailbox: 'INBOX',
    subject: '真实主题',
    from: 'sender@example.invalid',
    to: 'person@example.invalid',
    receivedAt: 1,
    read: false,
    starred: false,
    cached: true,
  };
  return {
    ready: true,
    accounts: [
      {
        id: message.accountId,
        providerCode: 'custom',
        email: 'person@example.invalid',
        displayName: '测试邮箱',
        status: AccountStatus.AccountConfigured,
        sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
      },
    ],
    accountId: '',
    chooseAccount: vi.fn(),
    messages: [message],
    detail: { ...message, body: '<script>not-executed()</script>', attachments: [] },
    selected: message.id,
    setSelected: vi.fn(),
    error: undefined,
    bodyError: undefined,
    bodyWaiting: false,
    retryBody: vi.fn(),
    refreshBody: vi.fn(),
    starPending: '',
    isStarPending: () => false,
    starError: undefined,
    toggleStarred: vi.fn(),
    loading: false,
    listKey: 'inbox',
    listLoading: false,
    listError: undefined,
    hasMore: false,
    listLimitReached: false,
    loadMore: vi.fn(),
    retryList: vi.fn(),
    refresh: vi.fn(),
    sync: vi.fn(),
    syncRequested: false,
    filter: '',
    setFilter: vi.fn(),
    resetView: vi.fn(),
    disconnectAccount: vi.fn(),
    ...overrides,
  };
}

it('真实邮件视图移除分页按钮，正文始终作为文本而不是 HTML', () => {
  const controller = makeController();
  const { container } = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={controller} />
    </I18nProvider>,
  );
  expect(screen.getByRole('heading', { name: '真实主题' })).toBeVisible();
  expect(screen.getByText('<script>not-executed()</script>')).toBeVisible();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.queryByRole('button', { name: '上一页' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument();
  expect(screen.queryByText('选择邮件后，可在这里查看内容。')).not.toBeInTheDocument();
});

it('初始账号读取失败显示安全原因和重试入口，不伪装成尚未接入的预览页', () => {
  const controller = makeController({
    ready: false,
    messages: [],
    detail: undefined,
    error: new Error('NETWORK_FAILED private-marker'),
  });
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={controller} />
    </I18nProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('无法连接邮件服务器');
  expect(screen.queryByText(/private-marker/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新加载邮箱' }));
  expect(controller.refresh).toHaveBeenCalledOnce();
});

it('同步失败的空列表显示原因和重新同步，不误报这个文件夹没有邮件', () => {
  const controller = makeController({
    messages: [],
    detail: undefined,
    selected: '',
    accounts: [
      {
        id: 'account-test',
        providerCode: 'qq',
        email: 'work@example.invalid',
        displayName: '',
        status: AccountStatus.AccountConfigured,
        sync: { running: false, more: false, errorCode: 'NETWORK_FAILED', lastSyncAt: 0 },
      },
    ],
  });
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={controller} />
    </I18nProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('无法连接邮件服务器');
  expect(screen.queryByText('此分类暂无已同步邮件')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新同步' }));
  expect(controller.sync).toHaveBeenCalledOnce();
});

it('正文失败有独立重试入口，提示不回显底层错误文本', () => {
  const controller = makeController({
    detail: undefined,
    bodyError: new Error('NETWORK_FAILED private-body-marker'),
  });
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={controller} />
    </I18nProvider>,
  );
  expect(screen.queryByText(/private-body-marker/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新加载正文' }));
  expect(controller.retryBody).toHaveBeenCalledOnce();
});

function renderList(mail: MailController, locale: 'zh-CN' | 'en' = 'zh-CN') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MailList mail={mail} formatTime={() => '12:00'} />
    </I18nProvider>,
  );
}

it.each(['zh-CN', 'en'] as const)(
  '列表在 %s 下展示短日期，完整信息可通过名称及统一提示读取，选中行为不变',
  (locale) => {
    const mail = makeController();
    const original = mail.messages[0];
    if (!original) throw new Error('测试邮件缺失');
    const receivedAt = new Date(2026, 9, 30, 1, 33).getTime();
    mail.messages = [{ ...original, receivedAt }];
    renderList(mail, locale);
    const row = screen.getByRole('button', { pressed: true });
    expect(row).toHaveAccessibleName(
      new RegExp(locale === 'zh-CN' ? '未读邮件' : 'Unread message'),
    );
    expect(row).toHaveAccessibleName(/sender@example.invalid/);
    expect(row).toHaveAccessibleName(/真实主题/);
    expect(row).toHaveAttribute('data-tooltip', row.getAttribute('aria-label'));
    const time = row.querySelector('time');
    expect(time).toHaveAttribute('datetime', new Date(receivedAt).toISOString());
    expect(time?.textContent).toContain(
      new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(receivedAt),
    );
    expect(time?.textContent).not.toContain('12:00');
    expect(row).toHaveAccessibleName(/12:00/);
    expect(row.querySelector('[aria-hidden="true"]')).toHaveTextContent('S');
    fireEvent.click(row);
    expect(mail.setSelected).toHaveBeenCalledExactlyOnceWith(original.id);
  },
);

it('空白发件人与主题、非法时间安全回退，已读状态不依赖颜色', () => {
  const mail = makeController();
  const original = mail.messages[0];
  if (!original) throw new Error('测试邮件缺失');
  mail.messages = [{ ...original, from: '  ', subject: '  ', receivedAt: NaN, read: true }];
  renderList(mail);
  const row = screen.getByRole('button', { pressed: true });
  expect(row).toHaveAccessibleName(/未知发件人/);
  expect(row).toHaveAccessibleName(/（无主题）/);
  expect(row).toHaveAccessibleName(/已读邮件/);
  expect(row).toHaveAttribute('data-read', 'true');
  expect(row.querySelector('time')).not.toHaveAttribute('datetime');
  expect(row.querySelector('time')).toHaveTextContent('—');
});

it('跨年邮件保留年份，避免短日期混淆，时间格式化不改变源数据', () => {
  const mail = makeController();
  const original = mail.messages[0];
  if (!original) throw new Error('测试邮件缺失');
  const receivedAt = new Date(new Date().getFullYear() - 1, 9, 30, 9, 30).getTime();
  mail.messages = [{ ...original, receivedAt }];
  renderList(mail, 'en');
  const time = screen.getByRole('button', { pressed: true }).querySelector('time');
  expect(time).toHaveTextContent(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(receivedAt),
  );
  expect(mail.messages[0]?.receivedAt).toBe(receivedAt);
});

it('超长不可信主题只作为文本展示，提示受长度限制且筛选仍匹配原文', () => {
  const mail = makeController();
  const original = mail.messages[0];
  if (!original) throw new Error('测试邮件缺失');
  const subject = `<img src=x onerror=alert(1)>${'长主题'.repeat(600)}检索词`;
  mail.messages = [
    { ...original, subject },
    { ...original, id: 'other', subject: '不匹配的主题', read: true },
  ];
  mail.filter = '检索词';
  renderList(mail);
  const row = screen.getByRole('button', { pressed: true });
  expect(row).toHaveTextContent(subject);
  expect(row).toHaveAccessibleName(new RegExp('检索词'));
  expect(row.querySelector('img')).toBeNull();
  expect(row.getAttribute('data-tooltip')?.length).toBeLessThanOrEqual(1024);
  expect(screen.queryByText('不匹配的主题')).not.toBeInTheDocument();
});

it('仅接近列表底部时请求更多，读取中或错误后不自动触发', () => {
  const mail = makeController({ hasMore: true });
  const view = renderList(mail);
  const list = screen.getByRole('region', { name: '邮件列表' });
  Object.defineProperties(list, {
    scrollHeight: { configurable: true, value: 1200 },
    clientHeight: { configurable: true, value: 400 },
  });
  list.scrollTop = 100;
  fireEvent.scroll(list);
  expect(mail.loadMore).not.toHaveBeenCalled();
  list.scrollTop = 700;
  fireEvent.scroll(list);
  expect(mail.loadMore).toHaveBeenCalledOnce();
  expect(mail.setSelected).not.toHaveBeenCalled();
  for (const state of [{ listLoading: true }, { listError: new Error('NETWORK_FAILED') }]) {
    view.rerender(
      <I18nProvider initialLocale="zh-CN">
        <MailList mail={{ ...mail, ...state }} formatTime={() => '12:00'} />
      </I18nProvider>,
    );
    fireEvent.scroll(list);
  }
  expect(mail.loadMore).toHaveBeenCalledOnce();
});

it('读取时不闪空态，失败保留列表、显示安全提示并支持键盘重试', () => {
  const mail = makeController({ messages: [], listLoading: true });
  const view = renderList(mail);
  expect(screen.getByRole('status')).toHaveTextContent('正在读取');
  expect(screen.queryByText('此分类暂无已同步邮件')).not.toBeInTheDocument();
  const failed = makeController({ listError: new Error('NETWORK_FAILED test-private-marker') });
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailList mail={failed} formatTime={() => '12:00'} />
    </I18nProvider>,
  );
  expect(screen.getByText('真实主题')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('无法连接邮件服务器');
  expect(screen.queryByText(/test-private-marker/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试加载' }));
  expect(failed.retryList).toHaveBeenCalledOnce();
  expect(screen.getByRole('region', { name: '邮件列表' })).toHaveFocus();
});

it('追加保留滚动容器，切换查询范围时才重置滚动位置', () => {
  const mail = makeController();
  const view = renderList(mail);
  const list = screen.getByRole('region', { name: '邮件列表' });
  list.scrollTop = 600;
  const first = mail.messages[0];
  if (!first) throw new Error('测试邮件缺失');
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailList
        mail={{ ...mail, messages: [...mail.messages, { ...first, id: 'second' }] }}
        formatTime={() => '12:00'}
      />
    </I18nProvider>,
  );
  expect(screen.getByRole('region', { name: '邮件列表' })).toBe(list);
  expect(list.scrollTop).toBe(600);
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailList mail={{ ...mail, listKey: 'starred' }} formatTime={() => '12:00'} />
    </I18nProvider>,
  );
  const next = screen.getByRole('region', { name: '邮件列表' });
  expect(next).not.toBe(list);
  expect(next.scrollTop).toBe(0);
  expect(within(next).getByRole('status')).toHaveTextContent('已加载全部已同步邮件');
});

it('筛选无匹配与没有邮件是不同状态，并如实提示已加载范围', () => {
  renderList(makeController({ filter: 'not-a-match' }));
  expect(screen.getByText(/已加载邮件中没有匹配项/)).toBeVisible();
  expect(screen.queryByText('此分类暂无已同步邮件')).not.toBeInTheDocument();
});
it('普通后台同步只在工具条同步按钮显示，邮件列表不显示进度条或误报空态', () => {
  const mail = makeController();
  const account = mail.accounts[0];
  if (!account) throw new Error('测试账号缺失');
  mail.accounts = [{ ...account, sync: { ...account.sync, running: true } }];
  mail.messages = [];
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  const button = screen.getByRole('button', { name: '同步邮件' });
  expect(button).toHaveTextContent('同步中');
  expect(button).toHaveAttribute('aria-busy', 'true');
  const list = screen.getByRole('region', { name: '邮件列表' });
  expect(within(list).queryByText(/后台正在同步|正在同步邮件/)).not.toBeInTheDocument();
  expect(within(list).queryByText('此分类暂无已同步邮件')).not.toBeInTheDocument();
});
it('星标按钮与邮件选择按钮独立，标星不顺带选择邮件，忙时禁止重复操作', () => {
  const mail = makeController();
  const view = renderList(mail);
  fireEvent.click(screen.getByRole('button', { name: '标星：真实主题' }));
  expect(mail.toggleStarred).toHaveBeenCalledOnce();
  expect(mail.setSelected).not.toHaveBeenCalled();
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailList
        mail={{ ...mail, starPending: 'mail-test', isStarPending: (id) => id === 'mail-test' }}
        formatTime={() => '12:00'}
      />
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: '标星：真实主题' })).toBeDisabled();
});

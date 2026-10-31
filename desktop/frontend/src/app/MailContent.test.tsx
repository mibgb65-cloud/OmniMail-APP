import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n/I18nProvider';
import type { MailController } from './useMail';
import { MailWorkspace } from './MailWorkspace';
import { MailList } from './MailList';
import { AccountStatus } from '../../bindings/omnimail/desktop/internal/domain/models';
import { DEFAULT_MAIL_VIEW } from './mailView';

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
    getStarred: (message) => message.starred,
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
    viewOptions: DEFAULT_MAIL_VIEW,
    setViewOptions: vi.fn(),
    actionBusy: false,
    actionError: undefined,
    autoReadError: undefined,
    markViewed: vi.fn(),
    runAction: vi.fn(),
    setFilter: vi.fn(),
    resetView: vi.fn(),
    disconnectAccount: vi.fn(),
    ...overrides,
  };
}

it('真实邮件视图移除分页按钮，正文始终作为文本而不是 HTML', async () => {
  const controller = makeController();
  const { container } = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={controller} />
    </I18nProvider>,
  );
  expect(await screen.findByRole('heading', { name: '真实主题' })).toBeVisible();
  expect(screen.getByText('<script>not-executed()</script>')).toBeVisible();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.queryByRole('button', { name: '上一页' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument();
  expect(screen.queryByText('选择邮件后，可在这里查看内容。')).not.toBeInTheDocument();
  expect(controller.markViewed).toHaveBeenCalledWith(controller.selected);
});

it('自动已读失败不隐藏正文，提示原因且不暴露底层错误', async () => {
  const mail = makeController({ autoReadError: new Error('NETWORK_FAILED private-marker') });
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  expect(await screen.findByRole('heading', { name: '真实主题' })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('自动标为已读失败');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private-marker');
  expect(screen.getByRole('button', { name: '标为已读' })).toBeEnabled();
});

it('工具栏真实操作、组合筛选和排序导航使用同一可见列表，保存中防止重复请求', () => {
  const base = makeController();
  const first = base.messages[0];
  if (!first) throw new Error('缺少夹具');
  const older = { ...first, id: 'older', receivedAt: 0, read: true, hasAttachments: true };
  const mail = makeController({ messages: [first, older], viewOptions: { ...DEFAULT_MAIL_VIEW } });
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: '上一封' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '下一封' }));
  expect(mail.setSelected).toHaveBeenCalledWith('older');
  fireEvent.click(screen.getByRole('button', { name: '归档' }));
  expect(mail.runAction).toHaveBeenLastCalledWith('archive', [first]);
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(mail.runAction).toHaveBeenLastCalledWith('deleted', [first]);
  fireEvent.click(screen.getByRole('button', { name: '标为已读' }));
  expect(mail.runAction).toHaveBeenLastCalledWith('read', [first]);
  fireEvent.click(screen.getByRole('button', { name: '全部已读' }));
  expect(mail.runAction).toHaveBeenLastCalledWith('allRead', [first]);
  fireEvent.click(screen.getByText('筛选', { selector: 'summary span' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '只看未读' }));
  expect(mail.setViewOptions).toHaveBeenLastCalledWith({ ...DEFAULT_MAIL_VIEW, unreadOnly: true });
  fireEvent.click(screen.getByRole('button', { name: '最新在前' }));
  expect(mail.setViewOptions).toHaveBeenLastCalledWith({ ...DEFAULT_MAIL_VIEW, oldestFirst: true });
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace
        mail={{
          ...mail,
          actionBusy: true,
          viewOptions: { ...DEFAULT_MAIL_VIEW, unreadOnly: true },
        }}
      />
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: '下一封' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '删除' })).toBeDisabled();
  expect(screen.getByText('显示 1 / 已加载 2 封')).toBeVisible();
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

it('筛选后空列表仍可继续加载，不要求有滚动条才能读取下一批', () => {
  const mail = makeController({
    hasMore: true,
    viewOptions: { ...DEFAULT_MAIL_VIEW, attachmentsOnly: true },
  });
  renderList(mail);
  fireEvent.click(screen.getByRole('button', { name: '继续加载邮件' }));
  expect(mail.loadMore).toHaveBeenCalledOnce();
});

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
it('正文网络读取阶段使用同一骨架屏而非裸露的加载文字或空 iframe', () => {
  const mail = makeController({ detail: undefined, loading: true });
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
  expect(screen.queryByTitle('邮件正文')).not.toBeInTheDocument();
});
it('阅读器不再显示数据库和脚本安全技术说明，保留正文与必要操作', async () => {
  render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={makeController()} />
    </I18nProvider>,
  );
  expect(
    screen.queryByText(/已下载的正文与原始 HTML 持久保存在本机数据库/),
  ).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: '复制发件人邮箱' })).toBeVisible();
  expect(screen.getByRole('button', { name: '复制收件人邮箱' })).toBeVisible();
});
it('直接切换到另一封已加载邮件时，头信息不会残留成两份', async () => {
  const mail = makeController();
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  if (!mail.detail) throw new Error('测试正文缺失');
  const next = {
    ...mail.detail,
    id: 'second-mail',
    subject: '另一封脱敏主题',
    from: 'other@example.invalid',
  };
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={{ ...mail, selected: next.id, detail: next, messages: [next] }} />
    </I18nProvider>,
  );
  expect(screen.queryByRole('heading', { name: '真实主题' })).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: '另一封脱敏主题' })).toBeVisible();
  expect(screen.getAllByRole('button', { name: '复制发件人邮箱' })).toHaveLength(1);
});
it('切换邮件立即统一为骨架，旧内容不留在骨架后面', () => {
  const mail = makeController();
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={{ ...mail, selected: 'next-mail', detail: undefined, loading: true }} />
    </I18nProvider>,
  );
  expect(screen.queryByRole('heading', { name: '真实主题', hidden: true })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '真实主题' })).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
});
it('切换账号或分类范围时清理旧视觉缓冲，不跨范围保留邮件内容', () => {
  const mail = makeController();
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace
        mail={{
          ...mail,
          listKey: 'another-scope',
          selected: 'next',
          detail: undefined,
          loading: true,
        }}
      />
    </I18nProvider>,
  );
  expect(screen.queryByRole('heading', { name: '真实主题', hidden: true })).not.toBeInTheDocument();
  expect(screen.getByRole('status', { name: '正在加载邮件内容' })).toBeVisible();
});
it('标题和列表复用星标操作与即时状态，状态更新不重播阅读页或携带正文提交', async () => {
  const mail = makeController();
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace mail={mail} />
    </I18nProvider>,
  );
  const page = document.querySelector('[data-mail-page]');
  fireEvent.click(await screen.findByRole('button', { name: '标记星标' }));
  expect(mail.toggleStarred).toHaveBeenCalledOnce();
  const input = vi.mocked(mail.toggleStarred).mock.calls[0]?.[0];
  expect(input).not.toHaveProperty('body');
  expect(input).not.toHaveProperty('bodyHtml');
  const first = mail.messages[0];
  if (!first) throw new Error('测试邮件缺失');
  view.rerender(
    <I18nProvider initialLocale="zh-CN">
      <MailWorkspace
        mail={{
          ...mail,
          messages: [{ ...first, starred: true }],
          getStarred: () => true,
          isStarPending: () => true,
        }}
      />
    </I18nProvider>,
  );
  expect(screen.getByRole('button', { name: '取消星标' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '取消星标' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '取消星标：真实主题' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(document.querySelector('[data-mail-page]')).toBe(page);
  expect(page).toHaveAttribute('data-phase', 'shown');
});

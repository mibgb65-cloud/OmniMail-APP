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

function renderList(mail: MailController) {
  return render(
    <I18nProvider initialLocale="zh-CN">
      <MailList mail={mail} formatTime={() => '12:00'} />
    </I18nProvider>,
  );
}

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

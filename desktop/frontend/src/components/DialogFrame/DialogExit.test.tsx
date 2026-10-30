import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import * as api from '../../lib/bridge/mail';
import { AccountStatus, Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { AccountDialog } from '../MailDialogs/AccountDialog';
import { ComposeDialog } from '../MailDialogs/ComposeDialog';
import { SettingsDialog } from '../SettingsDialog/SettingsDialog';

vi.mock('../../lib/bridge/mail', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/mail')>()),
  providers: vi.fn(),
  addAccount: vi.fn(),
  send: vi.fn(),
}));

function pending<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function exitAnimations(dialog: HTMLElement) {
  const frame = pending<void>();
  const backdrop = pending<void>();
  // jsdom 没有 CSS/WAAPI；仅模拟浏览器动画的完成信号，真实插值另用 Chromium 验证。
  Object.defineProperty(dialog, 'getAnimations', {
    configurable: true,
    value: () => [
      ...[frame, backdrop].map((animation) => ({
        finished: animation.promise,
        effect: { target: dialog, getComputedTiming: () => ({ endTime: 140 }) },
      })),
      {
        finished: new Promise<void>(() => {}),
        effect: {
          target: dialog.querySelector('button'),
          getComputedTiming: () => ({ endTime: Infinity }),
        },
      },
    ],
  });
  return { frame, backdrop };
}

function settings(onClose = vi.fn(), onToggleTheme = vi.fn()) {
  const view = render(
    <I18nProvider initialLocale="zh-CN">
      <SettingsDialog theme="light" onToggleTheme={onToggleTheme} onClose={onClose} />
    </I18nProvider>,
  );
  const dialog = screen.getByRole('dialog', { name: '设置' });
  return { ...view, dialog, onClose, onToggleTheme, ...exitAnimations(dialog) };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('关闭按钮先播放退出，外框和遮罩都结束后才关闭，重复操作只通知一次', async () => {
  const view = settings();
  const close = screen.getByRole('button', { name: '关闭设置' });
  const theme = screen.getByRole('switch', { name: '深色模式' });
  fireEvent.click(close);
  expect(view.dialog).toHaveAttribute('open');
  expect(view.dialog).toHaveAttribute('data-closing', 'true');
  expect(view.onClose).not.toHaveBeenCalled();
  fireEvent.click(close);
  fireEvent.click(theme);
  expect(view.onToggleTheme).not.toHaveBeenCalled();
  await act(async () => view.frame.resolve());
  expect(view.dialog).toHaveAttribute('open');
  expect(view.onClose).not.toHaveBeenCalled();
  await act(async () => view.backdrop.resolve());
  expect(view.dialog).not.toHaveAttribute('open');
  expect(view.onClose).toHaveBeenCalledOnce();
});

it.each(['done', 'escape', 'backdrop'])('设置 %s 入口同样等待退出动画', async (method) => {
  const view = settings();
  if (method === 'done') fireEvent.click(screen.getByRole('button', { name: '完成' }));
  else if (method === 'escape') {
    fireEvent(view.dialog, new Event('cancel', { cancelable: true }));
  } else {
    vi.spyOn(view.dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 500, 400));
    fireEvent.pointerDown(view.dialog, { clientX: 20, clientY: 20 });
    fireEvent.click(view.dialog, { clientX: 20, clientY: 20 });
  }
  expect(view.dialog).toHaveAttribute('open');
  expect(view.onClose).not.toHaveBeenCalled();
  await act(async () => {
    view.frame.resolve();
    view.backdrop.resolve();
  });
  expect(view.onClose).toHaveBeenCalledOnce();
});

it('减少动效时不等动画，直接关闭并通知业务', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  const view = settings();
  fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
  expect(view.dialog).not.toHaveAttribute('open');
  expect(view.onClose).toHaveBeenCalledOnce();
});

it('动画取消也能关闭，不能依赖 animationend 永久等待', async () => {
  const view = settings();
  fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
  await act(async () => {
    view.frame.reject(new Error('animation canceled'));
    view.backdrop.reject(new Error('animation canceled'));
  });
  expect(view.onClose).toHaveBeenCalledOnce();
  expect(view.dialog).not.toHaveAttribute('open');
});

it('动画完成信号缺失时有有界兜底，晚到完成信号不重复关闭', async () => {
  vi.useFakeTimers();
  const view = settings();
  fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
  expect(view.onClose).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(view.onClose).toHaveBeenCalledOnce();
  await act(async () => {
    view.frame.resolve();
    view.backdrop.resolve();
  });
  expect(view.onClose).toHaveBeenCalledOnce();
});

it('强制卸载后旧动画完成不通知业务，也不误关新挂载的弹窗', async () => {
  const old = settings();
  fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
  old.unmount();
  const onClose = vi.fn();
  render(
    <StrictMode>
      <I18nProvider initialLocale="zh-CN">
        <SettingsDialog theme="light" onToggleTheme={vi.fn()} onClose={onClose} />
      </I18nProvider>
    </StrictMode>,
  );
  await act(async () => {
    old.frame.resolve();
    old.backdrop.resolve();
  });
  expect(old.onClose).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveAttribute('open');
});

it('账号等待期间点击关闭立即取消请求，保留退出画面但不提交后续账号', async () => {
  vi.mocked(api.providers).mockResolvedValue([
    {
      code: 'gmail',
      name: 'Gmail',
      authKinds: [api.AuthKind.AuthPassword],
      endpoints: [
        {
          protocol: Protocol.ProtocolIMAP,
          host: 'imap.gmail.com',
          port: 993,
          tlsMode: api.TLSMode.TLSImplicit,
        },
        {
          protocol: Protocol.ProtocolSMTP,
          host: 'smtp.gmail.com',
          port: 465,
          tlsMode: api.TLSMode.TLSImplicit,
        },
      ],
    },
  ]);
  const response = pending<api.AccountSummary>();
  vi.mocked(api.addAccount).mockReturnValue(response.promise);
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <AccountDialog onClose={onClose} onSaved={onSaved} />
    </I18nProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Gmail' }));
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'test@gmail.com' } });
  fireEvent.change(screen.getByLabelText('应用专用密码'), { target: { value: 'test-only-code' } });
  fireEvent.click(screen.getByRole('button', { name: '添加同服务商账号' }));
  const second = within(screen.getByRole('group', { name: '账号 2' }));
  fireEvent.change(second.getByLabelText('邮箱地址'), { target: { value: 'second@gmail.com' } });
  fireEvent.change(second.getByLabelText('应用专用密码'), {
    target: { value: 'test-second-code' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并添加 2 个账号' }));
  const dialog = screen.getByRole('dialog');
  const animation = exitAnimations(dialog);
  const signal = vi.mocked(api.addAccount).mock.calls[0]?.[1];
  expect(signal?.aborted).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(signal?.aborted).toBe(true);
  expect(dialog).toHaveAttribute('open');
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => response.reject(new Error('CANCELED')));
  expect(onSaved).not.toHaveBeenCalled();
  expect(api.addAccount).toHaveBeenCalledOnce();
  await act(async () => {
    animation.frame.resolve();
    animation.backdrop.resolve();
  });
  expect(onClose).toHaveBeenCalledOnce();
  expect(onSaved).not.toHaveBeenCalled();
  expect(api.addAccount).toHaveBeenCalledOnce();
});

it('撰写的关闭入口也使用同一退出流程', async () => {
  const onClose = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <ComposeDialog accounts={[]} selectedAccount="" onClose={onClose} onSent={vi.fn()} />
    </I18nProvider>,
  );
  const dialog = screen.getByRole('dialog');
  const animation = exitAnimations(dialog);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(dialog).toHaveAttribute('open');
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => {
    animation.frame.resolve();
    animation.backdrop.resolve();
  });
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});

it('撰写发送过程中仍禁止关闭，不因新增退出流程中止或重复发信', () => {
  vi.mocked(api.send).mockReturnValue(new Promise(() => {}));
  const onClose = vi.fn();
  render(
    <I18nProvider initialLocale="zh-CN">
      <ComposeDialog
        accounts={[
          {
            id: 'test-account',
            providerCode: 'custom',
            email: 'test@example.invalid',
            displayName: '测试账号',
            status: AccountStatus.AccountConfigured,
            sync: { running: false, more: false, errorCode: '', lastSyncAt: 0 },
          },
        ]}
        selectedAccount="test-account"
        onClose={onClose}
        onSent={vi.fn()}
      />
    </I18nProvider>,
  );
  fireEvent.change(screen.getByLabelText('收件人'), { target: { value: 'to@example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  const dialog = screen.getByRole('dialog');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled();
  expect(dialog).not.toHaveAttribute('data-closing');
  expect(dialog).toHaveAttribute('open');
  expect(onClose).not.toHaveBeenCalled();
  expect(api.send).toHaveBeenCalledOnce();
});

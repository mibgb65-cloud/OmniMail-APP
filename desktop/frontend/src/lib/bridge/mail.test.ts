import { describe, expect, it, vi } from 'vitest';
import { System } from '@wailsio/runtime';
import * as native from '../../../bindings/omnimail/desktop/internal/bridge/mailbridge';
import { accounts, errorCode } from './mail';

vi.mock('@wailsio/runtime', async (original) => ({
  ...(await original<typeof import('@wailsio/runtime')>()),
  System: { IsDesktop: vi.fn(() => false) },
}));
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/mailbridge', () => ({
  Accounts: vi.fn(),
}));

describe('邮件桥接边界', () => {
  it('浏览器预览不创建随后被取消的原生调用', async () => {
    vi.mocked(System.IsDesktop).mockReturnValue(false);
    await expect(accounts()).rejects.toThrow('BRIDGE_UNAVAILABLE');
    expect(native.Accounts).not.toHaveBeenCalled();
  });
  it('开始前已取消时不调用原生服务', async () => {
    vi.mocked(System.IsDesktop).mockReturnValue(true);
    const controller = new AbortController();
    controller.abort();
    await expect(accounts(controller.signal)).rejects.toThrow('CANCELED');
    expect(native.Accounts).not.toHaveBeenCalled();
  });
  it('未知 IPC 错误不作为 UI 文案，已知错误只返回白名单代码', () => {
    expect(errorCode(new Error('password=private-value'))).toBe('BRIDGE_UNAVAILABLE');
    expect(errorCode(new Error('call failed: AUTH_INVALID'))).toBe('AUTH_INVALID');
  });
});

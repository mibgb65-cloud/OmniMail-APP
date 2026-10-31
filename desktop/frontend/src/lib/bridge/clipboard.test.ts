import { System } from '@wailsio/runtime';
import * as native from '../../../bindings/omnimail/desktop/internal/bridge/appbridge';
import { expect, it, vi } from 'vitest';
import { copyMailAddresses, mailAddressesForCopy } from './clipboard';

vi.mock('@wailsio/runtime', () => ({
  System: { IsDesktop: vi.fn(() => true) },
}));
vi.mock('../../../bindings/omnimail/desktop/internal/bridge/appbridge', () => ({
  CopyMailAddresses: vi.fn().mockResolvedValue(undefined),
}));

it('桌面只写入被点击的邮箱列表，保留顺序且不读取剪贴板', async () => {
  await copyMailAddresses('sender@example.invalid');
  expect(native.CopyMailAddresses).toHaveBeenCalledExactlyOnceWith('sender@example.invalid');
  await copyMailAddresses(' one@example.invalid, Two+tag@example.invalid ');
  expect(native.CopyMailAddresses).toHaveBeenLastCalledWith(
    'one@example.invalid, Two+tag@example.invalid',
  );
});

it('拒绝空白、控制字符、非邮箱和超长内容，不把恶意文本写入剪贴板', async () => {
  vi.mocked(native.CopyMailAddresses).mockClear();
  for (const value of [
    '',
    '  ',
    'missing-address',
    '<script>@example.invalid',
    'person@example.invalid\nsecret',
    'x'.repeat(4097),
    null,
  ]) {
    expect(mailAddressesForCopy(value)).toBeUndefined();
    await expect(copyMailAddresses(value)).rejects.toThrow('COPY_UNAVAILABLE');
  }
  expect(native.CopyMailAddresses).not.toHaveBeenCalled();
});

it('剪贴板错误只返回安全标识，浏览器使用可用的标准写入能力', async () => {
  vi.mocked(native.CopyMailAddresses).mockRejectedValueOnce(new Error('private clipboard details'));
  await expect(copyMailAddresses('reader@example.invalid')).rejects.toThrow('COPY_UNAVAILABLE');
  vi.mocked(System.IsDesktop).mockReturnValue(false);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await copyMailAddresses('reader@example.invalid');
  expect(writeText).toHaveBeenCalledExactlyOnceWith('reader@example.invalid');
});

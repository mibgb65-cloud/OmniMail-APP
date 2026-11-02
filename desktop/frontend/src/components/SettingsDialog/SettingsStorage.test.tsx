import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { getStorageUsage, type StorageUsage } from '../../lib/bridge/storage';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { formatStorageBytes, SettingsStorage } from './SettingsStorage';

vi.mock('../../lib/bridge/storage', () => ({ getStorageUsage: vi.fn() }));
const empty: StorageUsage = {
  totalBytes: 0,
  mailDataBytes: 0,
  attachmentsBytes: 0,
  logsBytes: 0,
  backupsBytes: 0,
  otherBytes: 0,
};
function panel(active = true) {
  return <I18nProvider initialLocale="zh-CN">{active && <SettingsStorage />}</I18nProvider>;
}
beforeEach(() => {
  vi.mocked(getStorageUsage).mockReset();
  vi.mocked(getStorageUsage).mockResolvedValue(empty);
});
it('小文件到大文件都使用有效单位显示', () => {
  expect([0, 1, 1024, 1024 ** 2, 1024 ** 3, 1024 ** 4].map(formatStorageBytes)).toEqual([
    '0 B',
    '1 B',
    '1.00 KB',
    '1.00 MB',
    '1.00 GB',
    '1.00 TB',
  ]);
});
it('只在进入存储页时读取，空目录无 NaN，刷新重取数据', async () => {
  const view = render(panel(false));
  expect(getStorageUsage).not.toHaveBeenCalled();
  view.rerender(panel());
  expect(await screen.findByText('当前数据目录尚无占用。')).toBeVisible();
  expect(screen.getByRole('img')).not.toHaveAccessibleName(/NaN|Infinity/);
  vi.mocked(getStorageUsage).mockResolvedValue({ ...empty, totalBytes: 1024, logsBytes: 1024 });
  fireEvent.click(screen.getByRole('button', { name: '刷新统计' }));
  expect(await screen.findAllByText('1.00 KB')).toHaveLength(2);
  expect(screen.queryByText('当前数据目录尚无占用。')).not.toBeInTheDocument();
});
it('加载时禁止重复刷新，失败不伪造零值，重试成功', async () => {
  vi.mocked(getStorageUsage).mockRejectedValue(new Error('private-storage-path'));
  render(panel());
  expect(screen.getByRole('button', { name: '刷新统计' })).toBeDisabled();
  expect(await screen.findByRole('alert')).toHaveTextContent('无法读取本机存储情况');
  expect(screen.queryByText('0 B')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).not.toHaveTextContent('private-storage-path');
  vi.mocked(getStorageUsage).mockResolvedValue(empty);
  fireEvent.click(screen.getByRole('button', { name: '重试统计' }));
  expect(await screen.findByText('当前数据目录尚无占用。')).toBeVisible();
});
it('切离或卸载取消请求，忽略已经过期的结果', async () => {
  let finish: (value: StorageUsage) => void = () => {};
  vi.mocked(getStorageUsage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(panel());
  const signal = vi.mocked(getStorageUsage).mock.calls[0]?.[0];
  view.rerender(panel(false));
  expect(signal?.aborted).toBe(true);
  await act(async () => finish({ ...empty, totalBytes: 123, logsBytes: 123 }));
  expect(screen.queryByText('123 B')).not.toBeInTheDocument();
  view.rerender(panel());
  await screen.findByText('当前数据目录尚无占用。');
  const current = vi.mocked(getStorageUsage).mock.calls[1]?.[0];
  view.unmount();
  expect(current?.aborted).toBe(true);
});

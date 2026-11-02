import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../../lib/bridge/ai';
import { I18nProvider } from '../../lib/i18n/I18nProvider';
import { AISettings } from './AISettings';

vi.mock('../../lib/bridge/ai', async (original) => ({
  ...(await original<typeof import('../../lib/bridge/ai')>()),
  aiConfig: vi.fn(),
  saveAIConfig: vi.fn(),
  testAIConnection: vi.fn(),
  clearAICaches: vi.fn(),
}));
const config: api.AIConfig = {
  endpoint: 'https://example.invalid/v1',
  model: 'test',
  language: 'zh',
  consent: true,
  hasKey: true,
  revision: 'rev_1',
};
beforeEach(() => {
  vi.mocked(api.aiConfig).mockReset().mockResolvedValue(config);
  vi.mocked(api.saveAIConfig)
    .mockReset()
    .mockImplementation(async (input) => ({
      ...config,
      endpoint: input.endpoint,
      model: input.model,
      consent: input.consent,
    }));
  vi.mocked(api.testAIConnection).mockReset().mockResolvedValue(undefined);
  vi.mocked(api.clearAICaches).mockReset().mockResolvedValue(undefined);
});
async function setup() {
  render(
    <I18nProvider initialLocale="zh-CN">
      <AISettings />
    </I18nProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled());
}
it('初次配置默认 DeepSeek Flash，但不自动保存、授权或测试', async () => {
  vi.mocked(api.aiConfig).mockResolvedValue({
    ...config,
    endpoint: '',
    model: '',
    revision: '',
    consent: false,
    hasKey: false,
  });
  await setup();
  expect(screen.getByLabelText('API 地址（Base URL）')).toHaveValue('https://api.deepseek.com');
  expect(screen.getByLabelText('模型名称')).toHaveValue('deepseek-flash');
  expect(screen.getByRole('checkbox', { name: /允许将/ })).not.toBeChecked();
  expect(screen.getByRole('button', { name: '测试已保存配置' })).toBeDisabled();
  expect(api.saveAIConfig).not.toHaveBeenCalled();
  expect(api.testAIConnection).not.toHaveBeenCalled();
});
it('已有自定义配置和已保存的停用状态都不被默认值覆盖', async () => {
  await setup();
  expect(screen.getByLabelText('API 地址（Base URL）')).toHaveValue(config.endpoint);
  expect(screen.getByLabelText('模型名称')).toHaveValue(config.model);
});
it('已保存的空配置不会被当作首次打开而重新启用 DeepSeek', async () => {
  vi.mocked(api.aiConfig).mockResolvedValue({
    ...config,
    endpoint: '',
    model: '',
    consent: false,
    hasKey: false,
  });
  await setup();
  expect(screen.getByLabelText('API 地址（Base URL）')).toHaveValue('');
  expect(screen.getByLabelText('模型名称')).toHaveValue('');
});
it('显式填入 DeepSeek 清除未保存的其他服务密钥并取消授权，不立即外发', async () => {
  await setup();
  fireEvent.change(screen.getByLabelText('API Key'), {
    target: { value: 'unsaved-other-service-key' },
  });
  fireEvent.click(screen.getByRole('button', { name: '填入 DeepSeek 默认配置' }));
  expect(screen.getByLabelText('API 地址（Base URL）')).toHaveValue('https://api.deepseek.com');
  expect(screen.getByLabelText('模型名称')).toHaveValue('deepseek-flash');
  expect(screen.getByLabelText('API Key')).toHaveValue('');
  expect(screen.getByRole('checkbox', { name: /允许将/ })).not.toBeChecked();
  expect(api.saveAIConfig).not.toHaveBeenCalled();
  expect(api.testAIConnection).not.toHaveBeenCalled();
});
it('已保存的官方 /v1 地址填入预设时保持目的地不变', async () => {
  vi.mocked(api.aiConfig).mockResolvedValue({ ...config, endpoint: 'https://api.deepseek.com/v1' });
  await setup();
  fireEvent.click(screen.getByRole('button', { name: '填入 DeepSeek 默认配置' }));
  expect(screen.getByLabelText('API 地址（Base URL）')).toHaveValue('https://api.deepseek.com/v1');
  expect(screen.getByLabelText('模型名称')).toHaveValue('deepseek-flash');
});
it('更换地址撤销勾选，不回显旧密钥；保存不会自动测试或分析', async () => {
  await setup();
  expect(screen.getByLabelText('API Key')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('API 地址（Base URL）'), {
    target: { value: 'https://other.invalid/v1' },
  });
  expect(screen.getByRole('checkbox', { name: /允许将/ })).not.toBeChecked();
  expect(screen.getByRole('button', { name: '测试已保存配置' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'synthetic-key' } });
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await screen.findByText('配置已保存。');
  expect(api.saveAIConfig).toHaveBeenCalledWith(
    expect.objectContaining({ consent: false, apiKey: 'synthetic-key' }),
    expect.any(AbortSignal),
  );
  expect(screen.getByLabelText('API Key')).toHaveValue('');
  expect(api.testAIConnection).not.toHaveBeenCalled();
});
it('连接测试必须主动点击，清理必须再次确认', async () => {
  await setup();
  expect(api.testAIConnection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '测试已保存配置' }));
  await screen.findByText(/固定文本连接及结构化响应验证通过/);
  fireEvent.click(screen.getByRole('button', { name: '清理 AI 和翻译缓存' }));
  expect(api.clearAICaches).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '再次点击确认清理' }));
  await screen.findByText('本机 AI 和翻译缓存已清理。');
  expect(api.clearAICaches).toHaveBeenCalledOnce();
});
it('读取失败不伪造默认配置，允许重试', async () => {
  vi.mocked(api.aiConfig).mockRejectedValueOnce(new Error('AI_STORAGE_FAILED'));
  render(
    <I18nProvider initialLocale="zh-CN">
      <AISettings />
    </I18nProvider>,
  );
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: '保存配置' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled());
});

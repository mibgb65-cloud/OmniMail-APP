import { act, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { expect, it } from 'vitest';

import { createI18nInstance, refreshI18nResources } from './instance';
import { resources } from './resources';

function FormPreview() {
  const { t } = useTranslation('mail');
  return (
    <label>
      {t('email')}
      <input placeholder={t('emailPlaceholder')} />
    </label>
  );
}

it('更新资源时已挂载表单立即刷新翻译，语言、输入内容和焦点不丢失', () => {
  const instance = createI18nInstance('en');
  const next = structuredClone(resources);
  next.en.mail.emailPlaceholder = 'Updated email placeholder';
  render(
    <I18nextProvider i18n={instance}>
      <FormPreview />
    </I18nextProvider>,
  );
  const field = screen.getByLabelText('Email address');
  fireEvent.change(field, { target: { value: 'person@example.invalid' } });
  field.focus();
  act(() => refreshI18nResources(instance, next));
  expect(field).toHaveAttribute('placeholder', 'Updated email placeholder');
  expect(field).toHaveValue('person@example.invalid');
  expect(field).toHaveFocus();
  expect(instance.language).toBe('en');
  expect(resources.en.mail.emailPlaceholder).toBe('name@example.com');
});

it('资源刷新移除旧键，且不污染其他实例与导入的资源', () => {
  const first = createI18nInstance('zh-CN');
  const second = createI18nInstance('zh-CN');
  first.addResource('zh-CN', 'mail', 'removedKey', '旧文案');
  const next = structuredClone(resources);
  next['zh-CN'].mail.emailDetectionHint = '更新后的识别说明';
  refreshI18nResources(first, next);
  expect(first.exists('removedKey', { ns: 'mail' })).toBe(false);
  expect(first.t('emailDetectionHint', { ns: 'mail' })).toBe('更新后的识别说明');
  expect(second.t('emailDetectionHint', { ns: 'mail' })).toBe(
    resources['zh-CN'].mail.emailDetectionHint,
  );
  expect(resources['zh-CN'].mail.emailDetectionHint).not.toBe('更新后的识别说明');
});

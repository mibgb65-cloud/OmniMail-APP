import { render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { I18nProvider } from './I18nProvider';
import * as instances from './instance';
import { useTranslation } from './useTranslation';

function InterpolatedPage({ name }: { name: string }) {
  const { t } = useTranslation('common');
  return <p>{t('developmentPreview', { name })}</p>;
}

function checkTranslationKeys(t: ReturnType<typeof useTranslation<'workspace'>>['t']) {
  expectTypeOf(t).toEqualTypeOf<TFunction<'workspace'>>();
  expectTypeOf(t('title')).toEqualTypeOf<string>();
  // @ts-expect-error 其他命名空间的键不能误用到工作台。
  t('check');
  // @ts-expect-error 指定默认文案也不能绕过键检查。
  t('missingKey', { defaultValue: 'Fallback' });
  // @ts-expect-error 未注册的命名空间必须被类型检查拦截。
  t('title', { ns: 'missingNamespace' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('翻译 Hook 适配', () => {
  it('保留 i18next 的命名空间、键和返回值类型', () => {
    const instance = instances.createI18nInstance('en');
    checkTranslationKeys(instance.getFixedT('en', 'workspace'));
  });

  it('插值作为 React 文本渲染，不执行外部输入或翻译中的 HTML', () => {
    const instance = instances.createI18nInstance('en');
    instance.addResource('en', 'common', 'developmentPreview', '<b>Hello</b>, {{name}}!');
    vi.spyOn(instances, 'createI18nInstance').mockReturnValue(instance);
    const name = '<img src=x onerror=alert(1)> & Bob';
    const { container } = render(
      <I18nProvider initialLocale="en">
        <InterpolatedPage name={name} />
      </I18nProvider>,
    );
    expect(screen.getByText(`<b>Hello</b>, ${name}!`)).toBeVisible();
    expect(container.querySelector('b, img, script')).toBeNull();
    expect(container.innerHTML).toContain('&lt;img');
    expect(container.innerHTML).not.toContain('&amp;lt;img');
  });
});

import { describe, expect, it } from 'vitest';

import { createI18nInstance } from './instance';
import { DEFAULT_LOCALE, resources, type Locale } from './resources';

describe('i18next 实例', () => {
  it.each(['zh-CN', 'en'] as const)('同步初始化 %s 的离线资源', (locale) => {
    const instance = createI18nInstance(locale);
    expect(instance.isInitialized).toBe(true);
    expect(instance.language).toBe(locale);
    expect(instance.t('title', { ns: 'workspace' })).toBe(resources[locale].workspace.title);
    expect(instance.hasLoadedNamespace('connection')).toBe(true);
    expect(instance.services.backendConnector.backend).toBeNull();
  });

  it('缺少英语文案时回退中文，不影响其他英语文案', () => {
    const instance = createI18nInstance('en');
    const workspace: Partial<typeof resources.en.workspace> = { ...resources.en.workspace };
    delete workspace.title;
    instance.removeResourceBundle('en', 'workspace');
    instance.addResourceBundle('en', 'workspace', workspace);
    expect(instance.t('title', { ns: 'workspace' })).toBe(resources['zh-CN'].workspace.title);
    expect(instance.t('intro', { ns: 'workspace' })).toBe(resources.en.workspace.intro);
  });

  it('整个命名空间缺失时仍回退中文', () => {
    const instance = createI18nInstance('en');
    instance.removeResourceBundle('en', 'connection');
    expect(instance.t('title', { ns: 'connection' })).toBe(resources['zh-CN'].connection.title);
  });

  it('空翻译回退中文，不让按钮或无障碍标签变为空白', () => {
    const instance = createI18nInstance('en');
    instance.addResource('en', 'common', 'languageLabel', '');
    expect(instance.t('languageLabel')).toBe(resources['zh-CN'].common.languageLabel);
  });

  it('资源与语言状态在不同实例间隔离，不修改导入的 JSON', async () => {
    const first = createI18nInstance('en');
    const second = createI18nInstance('en');
    first.addResource('en', 'workspace', 'title', 'Changed only in this instance');
    expect(second.t('title', { ns: 'workspace' })).toBe(resources.en.workspace.title);
    expect(resources.en.workspace.title).toBe('Your email workspace starts here.');
    await first.changeLanguage('zh-CN');
    expect(first.language).toBe('zh-CN');
    expect(second.language).toBe('en');
  });

  it.each(['fr', '../../en', '', null, {}])('非法初始语言 %j 安全回退', (locale) => {
    const instance = createI18nInstance(locale as Locale);
    expect(instance.language).toBe(DEFAULT_LOCALE);
    expect(instance.t('languageLabel')).toBe(resources[DEFAULT_LOCALE].common.languageLabel);
  });

  it('使用原生插值，保留字符供 React 做文本转义', () => {
    const instance = createI18nInstance('en');
    instance.addResource('en', 'common', 'documentDescription', 'Hello, {{name}}!');
    expect(instance.t('documentDescription', { name: 'Alice & Bob' })).toBe('Hello, Alice & Bob!');
  });

  it.each([
    ['en', 0, '0 messages'],
    ['en', 1, '1 message'],
    ['en', 2, '2 messages'],
    ['zh-CN', 0, '0 封邮件'],
    ['zh-CN', 1, '1 封邮件'],
    ['zh-CN', 2, '2 封邮件'],
  ] as const)('按 %s 的规则渲染数量 %i', (locale, count, expected) => {
    const instance = createI18nInstance(locale);
    // 仅在测试实例追加复数变体，不为尚未实现的邮件功能添加产品文案。
    instance.addResourceBundle('en', 'common', {
      developmentPreview_one: '{{count}} message',
      developmentPreview_other: '{{count}} messages',
    });
    instance.addResourceBundle('zh-CN', 'common', {
      developmentPreview_other: '{{count}} 封邮件',
    });
    expect(instance.t('developmentPreview', { count })).toBe(expected);
  });
});

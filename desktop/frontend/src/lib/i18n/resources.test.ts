import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, resources, SUPPORTED_LOCALES } from './resources';

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function messageKeys(messages: Record<string, string>) {
  return [...new Set(Object.keys(messages).map((key) => key.replace(PLURAL_SUFFIX, '')))].sort();
}

function checkMessages(
  locale: string,
  messages: Record<string, string>,
  reference: Record<string, string>,
) {
  expect(messageKeys(messages)).toEqual(messageKeys(reference));
  for (const message of Object.values(messages)) {
    expect(typeof message).toBe('string');
    expect(message.trim().length).toBeGreaterThan(0);
  }
  // 比较逻辑键，复数变体按语言规则检查；中文无需为了和英语对齐而伪造 _one。
  const pluralKeys = Object.keys(messages).filter((key) => PLURAL_SUFFIX.test(key));
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  for (const key of pluralKeys) {
    const base = key.replace(PLURAL_SUFFIX, '');
    for (const category of categories) {
      expect(messages[`${base}_${category}`]).toBeTypeOf('string');
    }
  }
}

describe('模块化语言包', () => {
  const reference = resources[DEFAULT_LOCALE];
  const namespaces = Object.keys(reference);

  it('所有语言具有相同的命名空间、文案键和非空文本', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(Object.keys(resources).sort());
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(resources[locale]).sort()).toEqual([...namespaces].sort());
      for (const namespace of Object.keys(reference) as (keyof typeof reference)[]) {
        checkMessages(locale, resources[locale][namespace], reference[namespace]);
      }
    }
  });

  it('每个语言文件都已注册，不遗漏未来页面的语言包', () => {
    const files = import.meta.glob('../../locales/*/*.json');
    const expected = SUPPORTED_LOCALES.flatMap((locale) =>
      namespaces.map((namespace) => `../../locales/${locale}/${namespace}.json`),
    );
    expect(Object.keys(files).sort()).toEqual(expected.sort());
  });

  it('允许不同语言采用不同数量的原生复数变体', () => {
    const chinese = { messages_other: '{{count}} 封邮件' };
    const english = { messages_one: '{{count}} message', messages_other: '{{count}} messages' };
    expect(() => checkMessages('zh-CN', chinese, english)).not.toThrow();
    expect(() => checkMessages('en', english, chinese)).not.toThrow();
  });

  it('仍然拦截漏键、多键、空翻译和缺少必要复数变体', () => {
    const reference = { title: '标题' };
    expect(() => checkMessages('en', {}, reference)).toThrow();
    expect(() => checkMessages('en', { title: 'Title', extra: 'Extra' }, reference)).toThrow();
    expect(() => checkMessages('en', { title: ' ' }, reference)).toThrow();
    const plural = { messages_other: '{{count}} messages' };
    expect(() => checkMessages('en', plural, plural)).toThrow();
  });
});

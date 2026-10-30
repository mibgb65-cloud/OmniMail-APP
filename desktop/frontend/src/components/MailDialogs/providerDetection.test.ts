import { describe, expect, it } from 'vitest';

import type { ProviderPreset } from '../../lib/bridge/mail';
import { detectEmailProvider, normalizeAccountEmail } from './providerDetection';

const presets: ProviderPreset[] = ['gmail', 'qq', 'netease_163', 'netease_126', 'custom'].map(
  (code) => ({ code, name: code, endpoints: [], authKinds: [] }),
);

describe('邮箱输入校验与服务商匹配', () => {
  it.each([
    '',
    'person',
    'person@',
    'person@@qq.com',
    'Name <person@qq.com>',
    'per son@qq.com',
    'person@qq.com\ninjected',
    '.person@qq.com',
    'person.@qq.com',
    'per..son@qq.com',
    'person@-qq.com',
    'person@qq-.com',
    'person@qq..com',
    'person@localhost',
    `person@${'a'.repeat(64)}.com`,
    `${'a'.repeat(65)}@qq.com`,
    `a@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(61)}.com`,
  ])('拒绝不完整、越界或不合法地址：%s', (value) => {
    expect(normalizeAccountEmail(value)).toBeNull();
    expect(detectEmailProvider(value, presets)).toBeUndefined();
  });

  it('去除首尾空白，保留本地部分大小写与加号别名', () => {
    expect(normalizeAccountEmail('  Person+work@QQ.COM  ')).toBe('Person+work@QQ.COM');
    expect(detectEmailProvider('  Person+work@QQ.COM  ', presets)?.code).toBe('qq');
  });

  it('接受 254 字符地址和 64 字符本地部分', () => {
    const address = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
    expect(address).toHaveLength(254);
    expect(normalizeAccountEmail(address)).toBe(address);
    expect(detectEmailProvider(address, presets)?.code).toBe('custom');
  });

  it.each([
    ['person@gmail.com', 'gmail'],
    ['person@QQ.COM', 'qq'],
    ['person@163.com', 'netease_163'],
    ['person@126.com', 'netease_126'],
    ['person@gmail.com.evil.invalid', 'custom'],
    ['person@sub.qq.com', 'custom'],
    ['person@notgmail.com', 'custom'],
    ['person@example.invalid', 'custom'],
  ])('完整域名匹配 %s → %s', (address, provider) => {
    expect(detectEmailProvider(address, presets)?.code).toBe(provider);
  });

  it('只使用桥接返回的服务商，不构造不存在的配置', () => {
    const custom = presets.filter((preset) => preset.code === 'custom');
    expect(detectEmailProvider('person@gmail.com', custom)?.code).toBe('custom');
    expect(detectEmailProvider('person@gmail.com', [])).toBeUndefined();
    expect(
      detectEmailProvider(
        'person@example.invalid',
        presets.filter((p) => p.code !== 'custom'),
      ),
    ).toBeUndefined();
  });
});

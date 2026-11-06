import { expect, it } from 'vitest';
import { providerAuthenticationHint, usesAppPassword } from './providerAuthentication';

it.each([null, 'custom', 'constructor', '__proto__', 'unknown'])(
  '未知或无专属说明的 code %s 不命中对象原型或其他服务商提示',
  (code) => {
    expect(providerAuthenticationHint(code)).toBeUndefined();
    expect(usesAppPassword(code)).toBe(false);
  },
);
it.each(['gmail', 'naver', 'yandex', 'icloud', 'yahoo'])('%s 明确使用应用密码', (code) => {
  expect(providerAuthenticationHint(code)).toBeDefined();
  expect(usesAppPassword(code)).toBe(true);
});

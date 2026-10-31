import { expect, it } from 'vitest';
import * as api from '../../lib/bridge/mail';
import { Protocol } from '../../../bindings/omnimail/desktop/internal/domain/models';
import { resolveProviderInput } from './providerInput';

const server = {
  host: 'base.example.invalid',
  port: 993,
  tlsMode: api.TLSMode.TLSImplicit,
  username: '',
  password: 'synthetic-code',
  authKind: api.AuthKind.AuthPassword,
};
const base: api.AddAccountInput = {
  providerCode: 'netease_163',
  email: '',
  displayName: '',
  imap: server,
  smtp: server,
};
const presets: api.ProviderPreset[] = ['netease_163', 'netease_126'].map((code) => ({
  code,
  name: code,
  authKinds: [api.AuthKind.AuthPassword],
  endpoints: [
    {
      protocol: Protocol.ProtocolIMAP,
      host: `${code}.imap.example.invalid`,
      port: 993,
      tlsMode: api.TLSMode.TLSImplicit,
    },
    {
      protocol: Protocol.ProtocolSMTP,
      host: `${code}.smtp.example.invalid`,
      port: 587,
      tlsMode: api.TLSMode.TLSStartTLS,
    },
  ],
}));
it.each([
  ['Person@163.COM', 'netease_163'],
  ['Person+tag@126.com', 'netease_126'],
])('网易统一入口仍为 %s 分配 %s 的真实端点', (email, code) => {
  const result = resolveProviderInput({ ...base, email }, presets);
  expect(result?.providerCode).toBe(code);
  expect(result?.imap.host).toBe(`${code}.imap.example.invalid`);
  expect(result?.smtp.host).toBe(`${code}.smtp.example.invalid`);
  expect(result?.smtp.port).toBe(587);
  expect(result?.smtp.tlsMode).toBe(api.TLSMode.TLSStartTLS);
  expect(result?.imap.username).toBe(email);
  expect(result?.smtp.password).toBe('synthetic-code');
  expect(base.imap.host).toBe('base.example.invalid');
});
it.each(['person@162.com', 'person@163.com.evil.invalid', 'person@example.invalid'])(
  '网易入口不把未知或伪造域名 %s 静默送往其他服务器',
  (email) => {
    expect(resolveProviderInput({ ...base, email }, presets)).toBeUndefined();
  },
);
it('缺失真实子预设时拒绝，不猜测服务器', () => {
  expect(
    resolveProviderInput({ ...base, email: 'person@126.com' }, presets.slice(0, 1)),
  ).toBeUndefined();
});
it('桥接缺少端点数组时安全拒绝，不产生请求或猜测端点', () => {
  expect(
    resolveProviderInput(
      { ...base, email: 'person@126.com' },
      presets.map((preset) => ({ ...preset, endpoints: null })),
    ),
  ).toBeUndefined();
});

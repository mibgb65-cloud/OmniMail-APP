import { expect, it } from 'vitest';
import * as api from '../../lib/bridge/mail';
import {
  buildBatchRequests,
  emptyDraft,
  MAX_BATCH_ACCOUNTS,
  type BatchResult,
} from './accountBatch';

const server = {
  host: 'imap.example.invalid',
  port: 993,
  tlsMode: api.TLSMode.TLSImplicit,
  authKind: api.AuthKind.AuthPassword,
  username: '',
  password: '',
};
const base: api.AddAccountInput = {
  providerCode: 'gmail',
  email: '',
  displayName: '',
  imap: server,
  smtp: { ...server, host: 'smtp.example.invalid', port: 465 },
};
const drafts = [0, 1].map((id) => ({
  ...emptyDraft(id),
  email: `person${id}@example.invalid`,
  name: '',
  username: `imap-user-${id}`,
  password: `incoming-secret-${id}`,
  smtpUsername: `smtp-user-${id}`,
  smtpPassword: `outgoing-secret-${id}`,
}));

it('同一预设共用端点，但各账号分别使用自己的邮箱和密码，不修改原草稿', () => {
  const result = buildBatchRequests(base, false, drafts, {});
  expect(result.issue).toBeUndefined();
  expect(
    result.items.map(({ input }) => [input.providerCode, input.imap.host, input.smtp.host]),
  ).toEqual(drafts.map(() => ['gmail', 'imap.example.invalid', 'smtp.example.invalid']));
  for (const item of result.items) {
    expect(item.input.imap.username).toBe(item.input.email);
    expect(item.input.smtp.username).toBe(item.input.email);
    expect(item.input.smtp.password).toBe(item.input.imap.password);
  }
  expect(drafts[0]?.smtpPassword).toBe('outgoing-secret-0');
});

it('自定义端点共用，收发信凭据按各账号和 same 策略独立映射', () => {
  const custom = { ...base, providerCode: 'custom' };
  const independent = buildBatchRequests(custom, false, drafts, {});
  expect(independent.items[1]?.input.smtp).toEqual(
    expect.objectContaining({
      host: 'smtp.example.invalid',
      username: 'smtp-user-1',
      password: 'outgoing-secret-1',
    }),
  );
  const shared = buildBatchRequests(custom, true, drafts, {});
  expect(shared.items[1]?.input.smtp).toEqual(
    expect.objectContaining({
      username: 'imap-user-1',
      password: 'incoming-secret-1',
    }),
  );
});

it('重复邮箱（大小写不敏感）在任何请求前拒绝', () => {
  const first = drafts[0];
  if (!first) throw new Error('缺少草稿');
  expect(
    buildBatchRequests(
      base,
      true,
      [first, { ...first, id: 2, email: first.email.toUpperCase() }],
      {},
    ),
  ).toEqual({ issue: 'duplicate', items: [] });
});

it('数量、编号、密码字节/控制字符、端口和主机有边界检查', () => {
  const first = drafts[0];
  if (!first) throw new Error('缺少草稿');
  expect(
    buildBatchRequests(
      base,
      true,
      Array.from({ length: MAX_BATCH_ACCOUNTS + 1 }, (_, id) => ({
        ...first,
        id,
        email: `x${id}@example.invalid`,
      })),
      {},
    ).issue,
  ).toBe('limit');
  for (const changed of [
    { ...first, id: -1 },
    { ...first, password: '' },
    { ...first, password: 'a\nb' },
    { ...first, password: '测'.repeat(400) },
    { ...first, name: 'x'.repeat(257) },
  ])
    expect(buildBatchRequests(base, true, [changed], {}).issue).toBe('invalid');
  expect(
    buildBatchRequests({ ...base, imap: { ...server, port: 0 } }, true, drafts, {}).issue,
  ).toBe('invalid');
  expect(
    buildBatchRequests({ ...base, imap: { ...server, host: 'bad/host' } }, true, drafts, {}).issue,
  ).toBe('invalid');
});

it('已添加和结果不确定的项目不再次提交，也不要求重新填写其密码', () => {
  const result: BatchResult = {
    id: 0,
    email: 'person0@example.invalid',
    name: '',
    status: 'review',
    errorCode: 'TIMEOUT',
  };
  const first = drafts[0];
  if (!first) throw new Error('缺少草稿');
  const built = buildBatchRequests(base, true, [{ ...first, password: '' }, ...drafts.slice(1)], {
    0: result,
  });
  expect(built.issue).toBeUndefined();
  expect(built.items.map((item) => item.id)).toEqual([1]);
});

it('自定义 IPv6 主机不被前端误拒绝', () => {
  expect(
    buildBatchRequests({ ...base, imap: { ...server, host: '::1]/path' } }, true, drafts, {}).issue,
  ).toBe('invalid');
  expect(
    buildBatchRequests({ ...base, imap: { ...server, host: '::1' } }, true, drafts, {}).issue,
  ).toBeUndefined();
});

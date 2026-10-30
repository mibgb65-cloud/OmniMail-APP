import * as api from '../../lib/bridge/mail';
import { normalizeAccountEmail } from './providerDetection';

export const MAX_BATCH_ACCOUNTS = 10;
export interface AccountDraft {
  id: number;
  email: string;
  name: string;
  username: string;
  password: string;
  smtpUsername: string;
  smtpPassword: string;
}
export type DraftField = Exclude<keyof AccountDraft, 'id'>;
export interface BatchRequest {
  id: number;
  input: api.AddAccountInput;
}
type ResultIdentity = { id: number; email: string; name: string };
export type BatchResult = ResultIdentity &
  (
    | { status: 'queued' | 'verifying' }
    | { status: 'added'; account: api.AccountSummary }
    | { status: 'failed' | 'review'; errorCode: ReturnType<typeof api.errorCode> }
  );
export type BatchIssue = 'invalid' | 'duplicate' | 'limit';
export const emptyDraft = (id: number): AccountDraft => ({
  id,
  email: '',
  name: '',
  username: '',
  password: '',
  smtpUsername: '',
  smtpPassword: '',
});
const validText = (value: string, max: number, required = false) =>
  (!required || value.length > 0) &&
  new TextEncoder().encode(value).length <= max &&
  !Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });
function validHost(host: string) {
  if (!validText(host, 253, true)) return false;
  if (host.includes(':')) {
    // 只允许 IPv6 字符，避免 URL 解析器把注入的括号/路径当作主机之外的内容接受。
    if (!/^[a-f\d:.]+$/i.test(host)) return false;
    try {
      return new URL(`https://[${host}]/`).hostname.startsWith('[');
    } catch {
      return false;
    }
  }
  return host
    .replace(/\.$/, '')
    .split('.')
    .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}
export function buildBatchRequests(
  base: api.AddAccountInput,
  same: boolean,
  drafts: AccountDraft[],
  results: Record<number, BatchResult>,
): { issue?: BatchIssue; items: BatchRequest[] } {
  if (drafts.length < 1 || drafts.length > MAX_BATCH_ACCOUNTS) return { issue: 'limit', items: [] };
  const emails = new Set<string>(),
    ids = new Set<number>();
  for (const draft of drafts) {
    const email = normalizeAccountEmail(draft.email);
    if (!email || !Number.isSafeInteger(draft.id) || draft.id < 0 || ids.has(draft.id)) {
      return { issue: 'invalid', items: [] };
    }
    ids.add(draft.id);
    // 仅用于批内去重，不改变实际发送给服务商的邮箱大小写。
    const key = email.toLowerCase();
    if (emails.has(key)) return { issue: 'duplicate', items: [] };
    emails.add(key);
  }
  const custom = base.providerCode === 'custom';
  for (const server of [base.imap, base.smtp]) {
    if (
      !validHost(server.host) ||
      !Number.isInteger(server.port) ||
      server.port < 1 ||
      server.port > 65535 ||
      ![api.TLSMode.TLSImplicit, api.TLSMode.TLSStartTLS].includes(server.tlsMode)
    ) {
      return { issue: 'invalid', items: [] };
    }
  }
  const items: BatchRequest[] = [];
  for (const draft of drafts) {
    if (results[draft.id]?.status === 'added' || results[draft.id]?.status === 'review') continue;
    const email = normalizeAccountEmail(draft.email);
    if (
      !email ||
      !validText(draft.name, 256) ||
      !validText(draft.password, 1024, true) ||
      (custom && !validText(draft.username, 320, true)) ||
      (custom &&
        !same &&
        (!validText(draft.smtpUsername, 320, true) || !validText(draft.smtpPassword, 1024, true)))
    ) {
      return { issue: 'invalid', items: [] };
    }
    const imap = {
      ...base.imap,
      username: custom ? draft.username : email,
      password: draft.password,
    };
    const smtp = {
      ...base.smtp,
      username: custom ? (same ? draft.username : draft.smtpUsername) : email,
      password: !custom || same ? draft.password : draft.smtpPassword,
    };
    items.push({ id: draft.id, input: { ...base, email, displayName: draft.name, imap, smtp } });
  }
  return { items };
}

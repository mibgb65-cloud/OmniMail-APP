import type { AccountSummary } from '../lib/bridge/mail';

export function mailboxState(account: AccountSummary) {
  if (account.status === 'disconnected') return 'disconnected';
  if (account.status === 'reauth_required') return 'reauth';
  if (account.sync.running) return 'running';
  if (account.sync.errorCode) return 'error';
  if (account.sync.more) return 'partial';
  return account.sync.lastSyncAt > 0 ? 'ready' : 'idle';
}

export const mailboxStateLabels = {
  disconnected: 'mailboxDisconnected',
  reauth: 'mailboxReauth',
  running: 'syncing',
  error: 'mailboxSyncFailed',
  partial: 'mailboxSyncPartial',
  ready: 'mailboxSynced',
  idle: 'mailboxNotSynced',
} as const;

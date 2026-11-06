import { AccountStatus } from '../../../bindings/omnimail/desktop/internal/domain/models';
import type { AccountSummary, MailSummary } from '../../lib/bridge/mail';
import type { TaskPreferences, TodoDetails, Todo } from '../../lib/bridge/taskModels';
export const account: AccountSummary = {
  id: 'account_test',
  email: 'synthetic@example.invalid',
  displayName: 'Synthetic',
  providerCode: 'custom',
  status: AccountStatus.AccountConfigured,
  sync: { running: false, more: false, errorCode: '', lastSyncAt: 1 },
};
export const mail: MailSummary = {
  id: 'mail_test',
  accountId: account.id,
  mailbox: 'INBOX',
  subject: 'synthetic mail',
  from: 'sender@example.invalid',
  to: 'synthetic@example.invalid',
  receivedAt: 1,
  read: false,
  starred: false,
  cached: true,
};
export const prefs: TaskPreferences = {
  enabled: false,
  consent: true,
  accounts: [account.id],
  folders: ['inbox'],
  time: '09:00',
  timezone: 'Asia/Singapore',
  limit: 20,
  revision: 'scope_1',
  aiRevision: 'ai_1',
};
export const todo: Todo = {
  id: 'todo_test',
  accountId: account.id,
  title: 'Original task',
  notes: 'human notes',
  owner: 'Alice',
  due: 'Friday',
  status: 'open',
  version: 1,
  createdAt: 1,
  updatedAt: 1,
};
export const details: TodoDetails = {
  item: todo,
  sources: [
    {
      id: 'source_test',
      todoId: todo.id,
      mailId: mail.id,
      accountId: account.id,
      subject: mail.subject,
      evidence: 'Please deliver Friday.',
      receivedAt: 1,
      available: true,
    },
  ],
  proposals: [
    {
      id: 'proposal_test',
      todoId: todo.id,
      sourceId: 'source_test',
      kind: 'update',
      title: 'Updated task',
      owner: '',
      due: 'Monday',
      reason: 'new date',
      evidence: 'Please deliver Monday.',
      state: 'open',
      createdAt: 2,
    },
  ],
  truncated: false,
};

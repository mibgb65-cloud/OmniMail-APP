import type {
  AIResult as NativeResult,
  AIRequest as NativeRequest,
} from '../../../bindings/omnimail/desktop/internal/domain/models';

export type AIResult = Omit<NativeResult, 'points' | 'tasks' | 'facts' | 'action'> & {
  points: NonNullable<NativeResult['points']>;
  tasks: NonNullable<NativeResult['tasks']>;
  facts: NonNullable<NativeResult['facts']>;
  action: 'analysis' | 'reply';
};
export type AIRequest = Omit<NativeRequest, 'action' | 'tone'> & {
  action: 'analysis' | 'reply';
  tone: '' | 'neutral' | 'friendly' | 'formal';
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && new TextEncoder().encode(value).length <= maximum;
export function isAIResult(value: unknown): value is AIResult {
  if (!record(value)) return false;
  return (
    text(value.accountId, 64) &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.accountId) &&
    text(value.mailId, 64) &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.mailId) &&
    text(value.sourceHash, 64) &&
    /^[a-f0-9]{64}$/.test(value.sourceHash) &&
    text(value.revision, 64) &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.revision) &&
    text(value.model, 128) &&
    (value.language === 'zh' || value.language === 'en') &&
    (value.action === 'analysis' || value.action === 'reply') &&
    typeof value.cached === 'boolean' &&
    (value.warning === '' || value.warning === 'CACHE_NOT_SAVED') &&
    text(value.summary, 4000) &&
    text(value.reply, 16 * 1024) &&
    (value.action === 'analysis'
      ? !!value.summary.trim() && !value.reply
      : !!value.reply.trim() && !value.summary) &&
    Array.isArray(value.points) &&
    value.points.length <= 12 &&
    value.points.every((item: unknown) => text(item, 1000)) &&
    Array.isArray(value.tasks) &&
    value.tasks.length <= 12 &&
    value.tasks.every(
      (item: unknown) =>
        record(item) &&
        text(item.text, 1000) &&
        text(item.evidence, 2000) &&
        text(item.owner, 200) &&
        text(item.due, 100),
    ) &&
    Array.isArray(value.facts) &&
    value.facts.length <= 12 &&
    value.facts.every(
      (item: unknown) => record(item) && text(item.text, 1000) && text(item.evidence, 2000),
    ) &&
    (value.action !== 'reply' ||
      value.points.length + value.tasks.length + value.facts.length === 0)
  );
}

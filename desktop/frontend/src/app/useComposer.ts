import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/bridge/mail';

export type ComposeField = keyof api.SendInput;
export interface ComposeSession extends api.SendInput {
  status: 'editing' | 'sending' | 'sent' | 'uncertain';
  error?: unknown;
}
type Confirmation = { kind: 'empty'; input: api.SendInput } | { kind: 'discard' };

function invalidInput(
  input: api.SendInput,
  accounts: api.AccountSummary[],
): ComposeField | undefined {
  if (
    !accounts.some((account) => account.id === input.accountId && account.status === 'configured')
  )
    return 'accountId';
  if (
    !input.to.trim() ||
    new TextEncoder().encode(input.to).length > 8192 ||
    /\p{Cc}/u.test(input.to)
  )
    return 'to';
  if (new TextEncoder().encode(input.subject).length > 512 || /\p{Cc}/u.test(input.subject))
    return 'subject';
  if (new TextEncoder().encode(input.body).length > 1_048_576) return 'body';
}

export function useComposer(accounts: api.AccountSummary[], onSent: () => void) {
  const [session, setSession] = useState<ComposeSession | null>(null);
  const [visible, setVisible] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [invalidField, setInvalidField] = useState<ComposeField>();
  const inFlight = useRef(false);
  const resultLocked = useRef(false);
  const draftClaimed = useRef(false);
  const request = useRef<AbortController>();
  useEffect(() => () => request.current?.abort(), []);

  const open = (preferred: string) => {
    draftClaimed.current = true;
    if (!session || session.status === 'sent') resultLocked.current = false;
    const available = accounts.filter((account) => account.status === 'configured');
    const accountId = preferred
      ? (available.find((account) => account.id === preferred)?.id ?? '')
      : available.length === 1
        ? (available[0]?.id ?? '')
        : '';
    setSession((current) =>
      current && current.status !== 'sent'
        ? current
        : {
            accountId,
            to: '',
            subject: '',
            body: '',
            status: 'editing',
          },
    );
    setVisible(true);
  };
  const update = (field: ComposeField, value: string) => {
    if (confirmation || inFlight.current) return;
    setSession((current) =>
      current?.status === 'editing' ? { ...current, [field]: value, error: undefined } : current,
    );
    setInvalidField(undefined);
  };
  const send = async (input: api.SendInput) => {
    if (inFlight.current || resultLocked.current) return;
    const invalid = invalidInput(input, accounts);
    setConfirmation(null);
    setInvalidField(invalid);
    if (invalid) {
      setSession((current) =>
        current
          ? {
              ...current,
              error: new Error(invalid === 'accountId' ? 'CREDENTIAL_MISSING' : 'INVALID_INPUT'),
            }
          : current,
      );
      return;
    }
    // React 状态发布前同步占用，阻止连续 submit 发出两个请求；浏览隐藏不取消 SMTP。
    inFlight.current = true;
    const controller = new AbortController();
    request.current = controller;
    setSession({ ...input, status: 'sending' });
    let accepted = false;
    try {
      await api.send(input, controller.signal);
      accepted = true;
      resultLocked.current = true;
    } catch (error) {
      if (!controller.signal.aborted) {
        // 桥接超时/取消无法证明 SMTP 未接受；不能把无法确认的返回当成可直接重发的失败。
        resultLocked.current = [
          'SEND_UNCERTAIN',
          'CANCELED',
          'TIMEOUT',
          'BRIDGE_UNAVAILABLE',
        ].includes(api.errorCode(error));
        setSession({
          ...input,
          error: resultLocked.current ? new Error('SEND_UNCERTAIN') : error,
          status: resultLocked.current ? 'uncertain' : 'editing',
        });
        if (api.errorCode(error) === 'INVALID_INPUT') setInvalidField('to');
      }
    } finally {
      inFlight.current = false;
      if (request.current === controller) request.current = undefined;
    }
    if (accepted && !controller.signal.aborted) {
      draftClaimed.current = false;
      setSession({ ...input, status: 'sent' });
      onSent();
    }
  };
  const requestSend = async () => {
    if (!session || session.status !== 'editing' || inFlight.current || resultLocked.current)
      return;
    const input = {
      accountId: session.accountId,
      to: session.to,
      subject: session.subject,
      body: session.body,
    };
    if (!invalidInput(input, accounts) && (!input.subject.trim() || !input.body.trim())) {
      setConfirmation({ kind: 'empty', input });
      return;
    }
    await send(input);
  };
  const confirmDiscard = () => {
    if (inFlight.current) return;
    resultLocked.current = false;
    draftClaimed.current = false;
    setConfirmation(null);
    setSession(null);
    setInvalidField(undefined);
    setVisible(false);
  };
  const discard = () => {
    if (!session || inFlight.current) return;
    if (
      session.status !== 'sent' &&
      (session.to || session.subject || session.body || session.status === 'uncertain')
    )
      setConfirmation({ kind: 'discard' });
    else confirmDiscard();
  };
  return {
    session,
    visible,
    confirmation,
    invalidField,
    hasSession: !!session && session.status !== 'sent',
    senderAvailable: accounts.some(
      (account) => account.id === session?.accountId && account.status === 'configured',
    ),
    open,
    adoptDraft: (preferred: string, body: string) => {
      // 同步占位防止一次渲染前连续采用；AI 不得覆盖编辑/发送中/结果不确定的会话。
      if (
        draftClaimed.current ||
        inFlight.current ||
        (session && session.status !== 'sent') ||
        !body.trim() ||
        new TextEncoder().encode(body).length > 16 * 1024
      )
        return false;
      const available = accounts.filter((account) => account.status === 'configured');
      if (!available.length) return false;
      const accountId =
        available.find((account) => account.id === preferred)?.id ??
        (available.length === 1 ? (available[0]?.id ?? '') : '');
      draftClaimed.current = true;
      resultLocked.current = false;
      setConfirmation(null);
      setInvalidField(undefined);
      setSession({ accountId, to: '', subject: '', body, status: 'editing' });
      setVisible(true);
      return true;
    },
    show: () => {
      if (session) setVisible(true);
    },
    update,
    requestSend,
    discard,
    confirmDiscard,
    hide: () => setVisible(false),
    cancelConfirmation: () => setConfirmation(null),
    confirmSend: async () => {
      if (confirmation?.kind === 'empty') await send(confirmation.input);
    },
  };
}
export type Composer = ReturnType<typeof useComposer>;

import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { ServerInput } from '../../../bindings/omnimail/desktop/internal/service/models';
import * as api from '../../lib/bridge/mail';
import { detectEmailProvider, normalizeAccountEmail } from './providerDetection';
import {
  buildBatchRequests,
  emptyDraft,
  MAX_BATCH_ACCOUNTS,
  type AccountDraft,
  type BatchIssue,
  type DraftField,
} from './accountBatch';
import { useSameProviderBatch } from './useSameProviderBatch';

const emptyServer = (port: number): ServerInput => ({
  host: '',
  port,
  username: '',
  password: '',
  tlsMode: api.TLSMode.TLSImplicit,
  authKind: api.AuthKind.AuthPassword,
});

export function useAccountForm(onSaved: () => void) {
  const [presets, setPresets] = useState<api.ProviderPreset[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [imap, setIMAP] = useState(emptyServer(993));
  const [smtp, setSMTP] = useState(emptyServer(465));
  const [same, setSame] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addedAccount, setAddedAccount] = useState<api.AccountSummary | null>(null);
  const [error, setError] = useState<unknown>();
  const [extraAccounts, setExtraAccounts] = useState<AccountDraft[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchIssue, setBatchIssue] = useState<BatchIssue>();
  const [editingDraftId, setEditingDraftId] = useState(0);
  const nextDraftId = useRef(1);
  const request = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const clearDraftSecrets = (id: number) => {
    if (id === 0) {
      setIMAP((value) => ({ ...value, password: '' }));
      setSMTP((value) => ({ ...value, password: '' }));
    } else {
      setExtraAccounts((rows) =>
        rows.map((row) => (row.id === id ? { ...row, password: '', smtpPassword: '' } : row)),
      );
    }
  };
  const batch = useSameProviderBatch(
    request,
    (id) => {
      clearDraftSecrets(id);
      onSaved();
    },
    clearDraftSecrets,
  );
  const drafts: AccountDraft[] = [
    {
      id: 0,
      email,
      name,
      username: imap.username,
      password: imap.password,
      smtpUsername: smtp.username,
      smtpPassword: smtp.password,
    },
    ...extraAccounts,
  ];
  const batchAdded = Object.values(batch.results).filter(
    (result) => result.status === 'added',
  ).length;
  const batchFailed = Object.values(batch.results).filter(
    (result) => result.status === 'failed',
  ).length;
  const batchReview = Object.values(batch.results).filter(
    (result) => result.status === 'review',
  ).length;
  const batchLocked = batchAdded + batchReview;
  const batchComplete =
    batchMode && batch.started && !batch.running && batchAdded === drafts.length;
  const isBusy = busy || batch.running;

  useEffect(() => {
    const controller = new AbortController();
    api
      .providers(controller.signal)
      .then((values) => {
        if (controller.signal.aborted) return;
        setPresets(values);
        setLoadStatus('success');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setError(error);
        setLoadStatus('error');
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [loadAttempt]);
  useEffect(() => {
    if (error || batchIssue || (batch.started && !batch.running && batchFailed + batchReview > 0)) {
      errorRef.current?.focus();
    }
  }, [error, batchIssue, batch.started, batch.running, batchFailed, batchReview]);

  const retryProviders = () => {
    setError(undefined);
    setLoadStatus('loading');
    setLoadAttempt((attempt) => attempt + 1);
  };
  const changeProvider = (code: string, address = email) => {
    const preset = presets.find((value) => value.code === code);
    if (!preset || isBusy || addedAccount || batchLocked > 0) return;
    batch.reset();
    setBatchIssue(undefined);
    setExtraAccounts((rows) =>
      rows.map((row) => ({
        ...row,
        username: row.email,
        smtpUsername: row.email,
        password: '',
        smtpPassword: '',
      })),
    );
    setProvider(code);
    setEmail(address);
    setError(undefined);
    const incoming = preset.endpoints?.find((endpoint) => endpoint.protocol === 'imap');
    const outgoing = preset.endpoints?.find((endpoint) => endpoint.protocol === 'smtp');
    setIMAP({
      ...emptyServer(993),
      host: incoming?.host ?? '',
      port: incoming?.port ?? 993,
      username: address,
      tlsMode: incoming?.tlsMode ?? api.TLSMode.TLSImplicit,
    });
    setSMTP({
      ...emptyServer(465),
      host: outgoing?.host ?? '',
      port: outgoing?.port ?? 465,
      username: address,
      tlsMode: outgoing?.tlsMode ?? api.TLSMode.TLSImplicit,
    });
  };
  const backToProviders = () => {
    if (isBusy || addedAccount || batchLocked > 0) return;
    batch.reset();
    setBatchIssue(undefined);
    setExtraAccounts((rows) => rows.map((row) => ({ ...row, password: '', smtpPassword: '' })));
    // 返回即清除秘密，不等再次选卡片；普通账号信息仅在当前弹窗内保留。
    setIMAP((value) => ({ ...value, password: '' }));
    setSMTP((value) => ({ ...value, password: '' }));
    setError(undefined);
    setProvider(null);
  };
  const changeEmail = (value: string) => {
    if (['added', 'review'].includes(batch.results[0]?.status ?? '')) return;
    if (!imap.username || imap.username === email) setIMAP({ ...imap, username: value });
    if (!smtp.username || smtp.username === email) setSMTP({ ...smtp, username: value });
    setEmail(value);
  };
  const addAccountDraft = () => {
    if (!provider || isBusy || addedAccount || batch.started) return;
    if (drafts.length >= MAX_BATCH_ACCOUNTS) {
      setBatchIssue('limit');
      return;
    }
    setBatchIssue(undefined);
    setBatchMode(true);
    const draft = emptyDraft(nextDraftId.current++);
    setEditingDraftId(draft.id);
    setExtraAccounts((rows) => [...rows, draft]);
  };
  const editAccountDraft = (id: number) => {
    if (
      isBusy ||
      !drafts.some((draft) => draft.id === id) ||
      ['added', 'review'].includes(batch.results[id]?.status ?? '')
    )
      return;
    setEditingDraftId(id);
  };
  const changeDraft = (id: number, field: DraftField, value: string) => {
    if (isBusy || ['added', 'review'].includes(batch.results[id]?.status ?? '')) return;
    setBatchIssue(undefined);
    if (id === 0) {
      if (field === 'email') changeEmail(value);
      if (field === 'name') setName(value);
      if (field === 'username') setIMAP((previous) => ({ ...previous, username: value }));
      if (field === 'password') setIMAP((previous) => ({ ...previous, password: value }));
      if (field === 'smtpUsername') setSMTP((previous) => ({ ...previous, username: value }));
      if (field === 'smtpPassword') setSMTP((previous) => ({ ...previous, password: value }));
      return;
    }
    setExtraAccounts((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        if (field !== 'email') return { ...row, [field]: value };
        return {
          ...row,
          email: value,
          username: !row.username || row.username === row.email ? value : row.username,
          smtpUsername:
            !row.smtpUsername || row.smtpUsername === row.email ? value : row.smtpUsername,
        };
      }),
    );
  };
  const removeAccountDraft = (id: number) => {
    if (isBusy || batch.started || !extraAccounts.length) return;
    if (id !== 0 && !extraAccounts.some((row) => row.id === id)) return;
    setBatchIssue(undefined);
    if (id === 0) {
      const first = extraAccounts[0];
      if (!first) return;
      setEmail(first.email);
      setName(first.name);
      setIMAP((value) => ({ ...value, username: first.username, password: first.password }));
      setSMTP((value) => ({
        ...value,
        username: first.smtpUsername,
        password: first.smtpPassword,
      }));
      setExtraAccounts(extraAccounts.slice(1));
      if (editingDraftId === 0 || editingDraftId === first.id) setEditingDraftId(0);
    } else {
      setExtraAccounts(extraAccounts.filter((row) => row.id !== id));
      if (editingDraftId === id) setEditingDraftId(0);
    }
    if (extraAccounts.length === 1) setBatchMode(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy || request.current || addedAccount || batchComplete) return;
    if (!provider) {
      const address = normalizeAccountEmail(email);
      const detected = loadStatus === 'success' ? detectEmailProvider(email, presets) : undefined;
      if (address && detected) changeProvider(detected.code, address);
      return;
    }
    if (batchMode) {
      const built = buildBatchRequests(
        {
          providerCode: provider,
          email,
          displayName: name,
          imap,
          smtp,
        },
        same,
        drafts,
        batch.results,
      );
      setBatchIssue(built.issue);
      setError(undefined);
      if (!built.issue) {
        try {
          await batch.run(built.items);
        } catch (error) {
          setError(error);
        }
      }
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    // 预设只接收邮箱和一套密码，不能受此前自定义的独立 SMTP 凭据状态影响。
    const presetLogin = provider !== 'custom';
    const incoming = presetLogin ? { ...imap, username: email } : imap;
    const outgoing = presetLogin
      ? { ...smtp, username: email, password: imap.password }
      : same
        ? { ...smtp, username: imap.username, password: imap.password }
        : smtp;
    try {
      const created = await api.addAccount(
        {
          providerCode: provider,
          email,
          displayName: name,
          imap: incoming,
          smtp: outgoing,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        // 账号已创建且后端已尝试安排同步；后续只展示结果，不能重复提交或继续持有表单秘密。
        setIMAP((value) => ({ ...value, password: '' }));
        setSMTP((value) => ({ ...value, password: '' }));
        setAddedAccount(created);
        onSaved();
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return {
    presets,
    loadStatus,
    provider,
    email,
    name,
    setName,
    imap,
    setIMAP,
    smtp,
    setSMTP,
    same,
    setSame,
    busy: isBusy,
    batch,
    batchMode,
    batchIssue,
    batchAdded,
    batchFailed,
    batchReview,
    batchLocked,
    batchComplete,
    drafts,
    editingDraftId,
    editAccountDraft,
    addAccountDraft,
    changeDraft,
    removeAccountDraft,
    addedAccount,
    error,
    request,
    errorRef,
    changeProvider,
    changeEmail,
    backToProviders,
    retryProviders,
    submit,
  };
}

export type AccountFormState = ReturnType<typeof useAccountForm>;

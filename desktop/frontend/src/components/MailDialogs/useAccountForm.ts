import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { ServerInput } from '../../../bindings/omnimail/desktop/internal/service/models';
import * as api from '../../lib/bridge/mail';

const emptyServer = (port: number): ServerInput => ({
  host: '',
  port,
  username: '',
  password: '',
  tlsMode: api.TLSMode.TLSImplicit,
  authKind: api.AuthKind.AuthPassword,
});

export function useAccountForm(onClose: () => void, onSaved: () => void) {
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
  const [error, setError] = useState<unknown>();
  const request = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

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
    if (error) errorRef.current?.focus();
  }, [error]);

  const retryProviders = () => {
    setError(undefined);
    setLoadStatus('loading');
    setLoadAttempt((attempt) => attempt + 1);
  };
  const changeProvider = (code: string) => {
    const preset = presets.find((value) => value.code === code);
    if (!preset || busy) return;
    setProvider(code);
    setError(undefined);
    const incoming = preset.endpoints?.find((endpoint) => endpoint.protocol === 'imap');
    const outgoing = preset.endpoints?.find((endpoint) => endpoint.protocol === 'smtp');
    setIMAP({
      ...emptyServer(993),
      host: incoming?.host ?? '',
      port: incoming?.port ?? 993,
      username: email,
      tlsMode: incoming?.tlsMode ?? api.TLSMode.TLSImplicit,
    });
    setSMTP({
      ...emptyServer(465),
      host: outgoing?.host ?? '',
      port: outgoing?.port ?? 465,
      username: email,
      tlsMode: outgoing?.tlsMode ?? api.TLSMode.TLSImplicit,
    });
  };
  const backToProviders = () => {
    if (busy) return;
    // 返回即清除秘密，不等再次选卡片；普通账号信息仅在当前弹窗内保留。
    setIMAP((value) => ({ ...value, password: '' }));
    setSMTP((value) => ({ ...value, password: '' }));
    setError(undefined);
    setProvider(null);
  };
  const changeEmail = (value: string) => {
    if (!imap.username || imap.username === email) setIMAP({ ...imap, username: value });
    if (!smtp.username || smtp.username === email) setSMTP({ ...smtp, username: value });
    setEmail(value);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!provider || busy || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      await api.addAccount(
        {
          providerCode: provider,
          email,
          displayName: name,
          imap,
          smtp: same ? { ...smtp, username: imap.username, password: imap.password } : smtp,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        onSaved();
        onClose();
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
    busy,
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

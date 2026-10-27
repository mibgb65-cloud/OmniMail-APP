import { useEffect, useState } from 'react';

import { getVersion, type VersionInfo } from '../lib/bridge/app';

export type ConnectionState =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; info: VersionInfo };

export function useVersion() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ConnectionState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void getVersion(controller.signal).then(
      (info) => {
        if (!controller.signal.aborted) setState({ status: 'success', info });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };
  return { state, retry };
}

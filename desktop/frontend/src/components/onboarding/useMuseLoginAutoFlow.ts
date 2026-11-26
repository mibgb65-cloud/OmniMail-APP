import { useCallback, useEffect, useRef, useState } from "react";
import {
  museMailApi,
  parseBackendError,
  type ParsedBackendError,
} from "../../services/backendClient";
import type { MuseLoginStage, MuseStatus } from "../../types/muse";
import type { AsyncActionStatus } from "../common/AsyncActionButton";
import {
  MUSE_DEFAULT_ACCOUNT_NAME,
  MUSE_LOGIN_POLL_INTERVAL_MS,
  resolveInitialMuseAccountName,
  shouldPollMuseLoginSession,
} from "./museConnectPolling";

export function useMuseLoginAutoFlow(initialStatus: MuseStatus) {
  const [loginStage, setLoginStage] = useState<MuseLoginStage>(() =>
    initialStatus.bound ? "connected" : initialStatus.loginStage,
  );
  const [verifiedEmail, setVerifiedEmail] = useState(() =>
    initialStatus.bound ? "" : initialStatus.verifiedEmail,
  );
  const [accountName, setAccountName] = useState(() =>
    !initialStatus.bound && initialStatus.verifiedEmail
      ? MUSE_DEFAULT_ACCOUNT_NAME
      : "",
  );
  const [openingLogin, setOpeningLogin] = useState(false);
  const [actionStatus, setActionStatus] = useState<AsyncActionStatus>("idle");
  const [error, setError] = useState<ParsedBackendError | null>(null);
  const [autoVerifyTried, setAutoVerifyTried] = useState(false);
  const [aborted, setAborted] = useState(false);

  const verifyLockRef = useRef(false);
  const probeLockRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const busy = actionStatus === "loading" || actionStatus === "success";

  const runVerifyOnce = useCallback(async () => {
    if (verifyLockRef.current || unmountedRef.current) return;
    verifyLockRef.current = true;
    setError(null);
    setActionStatus("loading");
    try {
      const res = await museMailApi.verifyConnection();
      if (unmountedRef.current) return;
      setVerifiedEmail(res.email);
      setLoginStage("verified");
      setAccountName((prev) => resolveInitialMuseAccountName(prev));
      setActionStatus("idle");
    } catch (err) {
      if (unmountedRef.current) return;
      setError(parseBackendError(err));
      setActionStatus("error");
    } finally {
      verifyLockRef.current = false;
    }
  }, []);

  const shouldPoll = shouldPollMuseLoginSession({
    loginStage,
    verifiedEmail,
    openingLogin,
    busy,
    autoVerifyTried,
    aborted,
  });

  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (cancelled || probeLockRef.current || verifyLockRef.current) return;
      probeLockRef.current = true;
      void museMailApi
        .checkLoginSessionReady()
        .then((probe) => {
          if (cancelled || unmountedRef.current) return;
          if (!probe.windowOpen) {
            setLoginStage((prev) => (prev === "login_open" ? "idle" : prev));
            return;
          }
          if (probe.sessionReady && !verifyLockRef.current) {
            setAutoVerifyTried(true);
            void runVerifyOnce();
          }
        })
        .catch(() => {})
        .finally(() => {
          probeLockRef.current = false;
        });
    }, MUSE_LOGIN_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shouldPoll, runVerifyOnce]);

  const openLoginWindow = async () => {
    setOpeningLogin(true);
    setAborted(false);
    setAutoVerifyTried(false);
    setError(null);
    if (actionStatus === "error") setActionStatus("idle");
    try {
      const next = await museMailApi.beginConnect();
      if (unmountedRef.current) return;
      setLoginStage(next.loginStage);
      setVerifiedEmail("");
    } catch (err) {
      if (unmountedRef.current) return;
      if (!initialStatus.bound) setLoginStage("idle");
      setError(parseBackendError(err));
    } finally {
      if (!unmountedRef.current) setOpeningLogin(false);
    }
  };

  return {
    loginStage,
    verifiedEmail,
    accountName,
    setAccountName,
    openingLogin,
    actionStatus,
    setActionStatus,
    error,
    setError,
    busy,
    verifyLockRef,
    markAborted: () => setAborted(true),
    openLoginWindow,
    runVerifyOnce,
  };
}

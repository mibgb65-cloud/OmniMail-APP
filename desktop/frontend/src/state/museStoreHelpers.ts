import { useCallback, useRef } from "react";
import { t } from "../i18n";
import {
  museMailApi,
  parseBackendError,
  type ParsedBackendError,
} from "../services/backendClient";
import {
  INITIAL_MUSE_STATUS,
  type MuseStatus,
  type MuseThreadDetail,
  type MuseThreadSummary,
} from "../types/muse";
import type { WorkspaceScreen } from "../types/ui";

export type MuseToastPushFn = (notice: {
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  detail?: string;
}) => void;

export interface MuseStateControllers {
  setStatus: React.Dispatch<React.SetStateAction<MuseStatus>>;
  setThreads: React.Dispatch<React.SetStateAction<MuseThreadSummary[]>>;
  setNextCursor: React.Dispatch<React.SetStateAction<string>>;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedThreadId: React.Dispatch<React.SetStateAction<string>>;
  setThreadDetail: React.Dispatch<
    React.SetStateAction<MuseThreadDetail | null>
  >;
  setListLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  setDetailLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveError: React.Dispatch<
    React.SetStateAction<ParsedBackendError | null>
  >;
  setClearedBySessionReset: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useMuseCollectionReset(ctrl: MuseStateControllers) {
  const listEpochRef = useRef(0);
  const detailEpochRef = useRef(0);

  const wipeMemoryCollections = useCallback(() => {
    listEpochRef.current += 1;
    detailEpochRef.current += 1;
    ctrl.setThreads([]);
    ctrl.setNextCursor("");
    ctrl.setHasMore(false);
    ctrl.setSelectedThreadId("");
    ctrl.setThreadDetail(null);
    ctrl.setListLoading(false);
    ctrl.setLoadingMore(false);
    ctrl.setDetailLoading(false);
  }, [ctrl]);

  const handleFatalCode = useCallback(
    (parsed: ParsedBackendError) => {
      if (parsed.code === "ERR_MUSE_CANCELLED") return;
      if (parsed.code === "ERR_MUSE_IDENTITY_CHANGED") {
        wipeMemoryCollections();
        ctrl.setStatus({ ...INITIAL_MUSE_STATUS, lastErrorCode: parsed.code });
      }
      ctrl.setActiveError(parsed);
    },
    [ctrl, wipeMemoryCollections],
  );

  const useDisconnectAndReset = (
    screen: WorkspaceScreen,
    setScreen: (next: WorkspaceScreen) => void,
    pushToast: MuseToastPushFn,
  ) => {
    const disconnect = useCallback(async () => {
      await museMailApi.disconnect();
      wipeMemoryCollections();
      ctrl.setStatus(INITIAL_MUSE_STATUS);
      ctrl.setActiveError(null);
      ctrl.setClearedBySessionReset(false);
      if (screen === "muse") setScreen("mail");
      pushToast({ tone: "info", title: t("muse.disconnectedToast") });
    }, [pushToast, screen, setScreen]);

    const resetForWorkspaceSwitch = useCallback(() => {
      wipeMemoryCollections();
      ctrl.setStatus(INITIAL_MUSE_STATUS);
      ctrl.setActiveError(null);
      ctrl.setClearedBySessionReset(true);
    }, []);

    return { disconnect, resetForWorkspaceSwitch };
  };

  const cancelRefresh = useCallback(async () => {
    listEpochRef.current += 1;
    ctrl.setListLoading(false);
    ctrl.setLoadingMore(false);
    await museMailApi.cancelRefresh();
  }, [ctrl]);

  return {
    listEpochRef,
    detailEpochRef,
    wipeMemoryCollections,
    handleFatalCode,
    cancelRefresh,
    useDisconnectAndReset,
    parseBackendError,
  };
}

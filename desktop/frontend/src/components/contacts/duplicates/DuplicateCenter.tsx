import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ContactMergeGroup,
  DuplicateGroupDTO,
} from "../../../../bindings/omnimail/internal/contacts/models";
import { contactApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";

function useDuplicateState() {
  const { workspace, toastStore } = useApp();
  const {
    activeProfileId: profileId,
    contacts,
    screen,
    setContacts,
  } = workspace;
  const [snapshot, setSnapshot] = useState<{
    profileId: string;
    groups: DuplicateGroupDTO[];
    error?: string;
  }>();
  const [revision, setRevision] = useState(0);
  const [hiddenProfiles, setHiddenProfiles] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const activeProfile = useRef(profileId);
  useEffect(() => {
    activeProfile.current = profileId;
  }, [profileId]);

  useEffect(() => {
    if (screen !== "contacts") return;
    let current = true;
    const timer = window.setTimeout(() => {
      void contactApi.findDuplicates(profileId).then(
        (groups) => {
          if (current) setSnapshot({ profileId, groups });
        },
        () => {
          if (current)
            setSnapshot({
              profileId,
              groups: [],
              error: "无法检测重复联系人，请重试。",
            });
        },
      );
    }, 100);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [screen, profileId, contacts, revision]);

  const mutate = async (action: () => Promise<void>, failure: string) => {
    if (operation.current) return false;
    operation.current = true;
    setBusy(true);
    try {
      await action();
      return activeProfile.current === profileId;
    } catch (err) {
      if (activeProfile.current === profileId)
        toastStore.pushToast({
          tone: "warning",
          title: failure,
          detail: parseBackendError(err).message,
        });
      return false;
    } finally {
      operation.current = false;
      setBusy(false);
      setRevision((value) => value + 1);
    }
  };

  const ignore = (key: string) =>
    mutate(async () => {
      await contactApi.ignoreDuplicates(profileId, key);
      setSnapshot((prev) =>
        prev?.profileId === profileId
          ? {
              ...prev,
              groups: prev.groups.filter((group) => group.key !== key),
            }
          : prev,
      );
      if (activeProfile.current === profileId)
        toastStore.pushToast({ tone: "info", title: "已忽略此组重复联系人" });
    }, "无法忽略重复联系人");

  const merge = (plans: ContactMergeGroup[]) =>
    mutate(async () => {
      const result = await contactApi.batchMerge(profileId, plans);
      const completed = new Set(plans.map((plan) => plan.groupKey));
      setSnapshot((prev) =>
        prev?.profileId === profileId
          ? {
              ...prev,
              groups: prev.groups.filter((group) => !completed.has(group.key)),
            }
          : prev,
      );
      if (activeProfile.current !== profileId) return;
      toastStore.pushToast({
        tone: "success",
        title: `已合并 ${result.groups} 组，精简 ${result.removed} 条联系人记录`,
        detail: "备用邮箱和历史往来邮件仍可在主联系人中查看。",
      });
      try {
        const fresh = await contactApi.listContactsForProfile(profileId);
        if (activeProfile.current === profileId) setContacts(fresh);
      } catch {
        if (activeProfile.current === profileId)
          toastStore.pushToast({
            tone: "warning",
            title: "合并已完成，通讯录暂未刷新",
          });
      }
    }, "无法合并重复联系人");

  const current = snapshot?.profileId === profileId ? snapshot : undefined;
  return {
    groups: current?.groups ?? [],
    error: current?.error,
    loading: !current,
    hidden: hiddenProfiles.has(profileId),
    dismiss: () =>
      setHiddenProfiles((previous) => new Set(previous).add(profileId)),
    refresh: () => setRevision((value) => value + 1),
    busy,
    merge,
    ignore,
  };
}

const DuplicateContext = createContext<ReturnType<
  typeof useDuplicateState
> | null>(null);

export function DuplicateCenter({ children }: { children: ReactNode }) {
  const state = useDuplicateState();
  return (
    <DuplicateContext.Provider value={state}>
      {children}
    </DuplicateContext.Provider>
  );
}

export function useDuplicateCenter() {
  const center = useContext(DuplicateContext);
  if (!center) throw new Error("重复联系人状态未初始化");
  return center;
}

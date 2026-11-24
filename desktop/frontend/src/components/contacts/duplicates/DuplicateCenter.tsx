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
import { t, useI18n } from "../../../i18n";
import { contactApi, parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";

function useDuplicateState() {
  const { workspace, toastStore } = useApp();
  const { t: tr } = useI18n();
  const {
    activeProfileId: profileId,
    contacts,
    screen,
    setContacts,
  } = workspace;
  const [snapshot, setSnapshot] = useState<{
    profileId: string;
    groups: DuplicateGroupDTO[];
    failed?: boolean;
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
          if (current) setSnapshot({ profileId, groups: [], failed: true });
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
        toastStore.pushToast({
          tone: "info",
          title: tr("toasts.ignoredDupGroup"),
        });
    }, tr("contacts.dupIgnoreFailed"));

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
        title: tr("toasts.mergedDupGroupsTitle", {
          groups: result.groups,
          removed: result.removed,
        }),
        detail: tr("toasts.mergedDupGroupsDetail"),
      });
      try {
        const fresh = await contactApi.listContactsForProfile(profileId);
        if (activeProfile.current === profileId) setContacts(fresh);
      } catch {
        if (activeProfile.current === profileId)
          toastStore.pushToast({
            tone: "warning",
            title: tr("toasts.mergedRefreshDelayed"),
          });
      }
    }, tr("contacts.dupMergeFailed"));

  const current = snapshot?.profileId === profileId ? snapshot : undefined;
  return {
    groups: current?.groups ?? [],
    error: current?.failed ? tr("contacts.dupDetectFailed") : undefined,
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
  if (!center) throw new Error(t("contacts.dupUninitialized"));
  return center;
}

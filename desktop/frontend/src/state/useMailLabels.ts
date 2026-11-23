import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { INITIAL_LABELS } from "../data/accounts";
import { mailApi } from "../services/backendClient";
import type { MailItem, MailLabel } from "../types/mail";
import { isWailsDesktop } from "./storageHelpers";

export function useMailLabels(
  mails: MailItem[],
  setMails: Dispatch<SetStateAction<MailItem[]>>,
  setActiveLabelId: Dispatch<SetStateAction<string | null>>,
) {
  const [labels, setLabels] = useState<MailLabel[]>(() =>
    isWailsDesktop() ? [] : INITIAL_LABELS,
  );

  const reloadLabels = useCallback(async () => {
    const list = await mailApi.listLabels().catch(() => []);
    setLabels(list);
  }, []);

  useEffect(() => {
    let active = true;
    void mailApi
      .listLabels()
      .then((list) => {
        if (active) setLabels(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const toggleMailLabel = useCallback(
    (mailIds: string[], labelId: string) => {
      const first = mails.find((m) => mailIds.includes(m.id));
      const removing = Boolean(first?.labels.includes(labelId));
      setMails((prev) =>
        prev.map((m) => {
          if (!mailIds.includes(m.id)) return m;
          const has = m.labels.includes(labelId);
          return {
            ...m,
            labels: has
              ? m.labels.filter((l) => l !== labelId)
              : [...m.labels, labelId],
          };
        }),
      );
      void mailApi
        .applyLabels(
          mailIds,
          removing ? [] : [labelId],
          removing ? [labelId] : [],
        )
        .catch(() => undefined);
    },
    [mails, setMails],
  );

  const createLabel = useCallback((name: string, color: string) => {
    const tempId = `lbl-${Date.now()}`;
    setLabels((prev) => [...prev, { id: tempId, name, color }]);
    void mailApi
      .saveLabel({ id: tempId, name, color })
      .then((saved) => {
        setLabels((prev) => prev.map((l) => (l.id === tempId ? saved : l)));
      })
      .catch(() => undefined);
    return tempId;
  }, []);

  const renameLabel = useCallback((id: string, name: string, color: string) => {
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name, color } : l)),
    );
    void mailApi.saveLabel({ id, name, color }).catch(() => undefined);
  }, []);

  const deleteLabel = useCallback(
    (id: string) => {
      setLabels((prev) => prev.filter((l) => l.id !== id));
      setMails((prev) =>
        prev.map((m) => ({
          ...m,
          labels: m.labels.filter((lid) => lid !== id),
        })),
      );
      setActiveLabelId((prev) => (prev === id ? null : prev));
      void mailApi.deleteLabel(id).catch(() => undefined);
    },
    [setMails, setActiveLabelId],
  );

  return {
    labels,
    reloadLabels,
    toggleMailLabel,
    createLabel,
    renameLabel,
    deleteLabel,
  };
}

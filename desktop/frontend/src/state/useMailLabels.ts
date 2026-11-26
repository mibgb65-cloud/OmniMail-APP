import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { INITIAL_LABELS } from "../data/accounts";
import { computeLabelTriState } from "../components/mail/labelPopoverLogic";
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
      if (mailIds.length === 0 || !labelId) return;
      const tri = computeLabelTriState(mails, mailIds, labelId);
      // 仅当全部已选邮件都拥有该标签时才移除；未选或半选状态统一将该标签应用到全部已选邮件
      const removing = tri === "checked";
      const idSet = new Set(mailIds);
      setMails((prev) =>
        prev.map((m) => {
          if (!idSet.has(m.id)) return m;
          const nextLabels = removing
            ? m.labels.filter((l) => l !== labelId)
            : m.labels.includes(labelId)
              ? m.labels
              : [...m.labels, labelId];
          return { ...m, labels: nextLabels };
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

  const createAndApplyLabel = useCallback(
    async (name: string, color: string, mailIds: string[]) => {
      const tempId = `lbl-${Date.now()}`;
      const idSet = new Set(mailIds);
      setLabels((prev) => [...prev, { id: tempId, name, color }]);
      if (mailIds.length > 0) {
        setMails((prev) =>
          prev.map((m) =>
            idSet.has(m.id) && !m.labels.includes(tempId)
              ? { ...m, labels: [...m.labels, tempId] }
              : m,
          ),
        );
      }
      try {
        const saved = await mailApi.saveLabel({ id: tempId, name, color });
        const finalId = saved.id || tempId;
        setLabels((prev) => prev.map((l) => (l.id === tempId ? saved : l)));
        if (finalId !== tempId && mailIds.length > 0) {
          setMails((prev) =>
            prev.map((m) =>
              idSet.has(m.id)
                ? {
                    ...m,
                    labels: m.labels.map((lid) =>
                      lid === tempId ? finalId : lid,
                    ),
                  }
                : m,
            ),
          );
        }
        if (mailIds.length > 0) {
          await mailApi.applyLabels(mailIds, [finalId], []);
        }
        return finalId;
      } catch {
        return tempId;
      }
    },
    [setMails],
  );

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
    createAndApplyLabel,
    renameLabel,
    deleteLabel,
  };
}

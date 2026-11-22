import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { INITIAL_LABELS } from "../data/accounts";
import type { MailItem, MailLabel } from "../types/mail";

export function useMailLabels(
  setMails: Dispatch<SetStateAction<MailItem[]>>,
  setActiveLabelId: Dispatch<SetStateAction<string | null>>,
) {
  const [labels, setLabels] = useState<MailLabel[]>(INITIAL_LABELS);

  const toggleMailLabel = useCallback(
    (mailIds: string[], labelId: string) => {
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
    },
    [setMails],
  );

  const createLabel = useCallback((name: string, color: string) => {
    const id = `lbl-${Date.now()}`;
    setLabels((prev) => [...prev, { id, name, color }]);
    return id;
  }, []);

  const renameLabel = useCallback((id: string, name: string, color: string) => {
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name, color } : l)),
    );
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
    },
    [setMails, setActiveLabelId],
  );

  return { labels, toggleMailLabel, createLabel, renameLabel, deleteLabel };
}

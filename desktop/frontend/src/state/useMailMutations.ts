import { useCallback, type Dispatch, type SetStateAction } from "react";
import { mailApi } from "../services/backendClient";
import type { FolderId, MailItem } from "../types/mail";
import { openedUnreadId } from "./mailReadingPolicy";
import { isWailsDesktop } from "./storageHelpers";

export function useMailMutations(
  mails: MailItem[],
  setMails: Dispatch<SetStateAction<MailItem[]>>,
  setCheckedIds: Dispatch<SetStateAction<string[]>>,
  setSelectedMailId: Dispatch<SetStateAction<string>>,
  activeFolder: FolderId,
  refreshCounts: () => Promise<void>,
  rememberRead: (ids: string[]) => void,
) {
  const toggleStar = useCallback(
    (mailIds: string[]) => {
      const first = mails.find((m) => mailIds.includes(m.id));
      const nextStar = !first?.starred;
      setMails((prev) =>
        prev.map((m) =>
          mailIds.includes(m.id) ? { ...m, starred: nextStar } : m,
        ),
      );
      void mailApi.toggleStar(mailIds, nextStar).then(() => refreshCounts());
    },
    [mails, refreshCounts, setMails],
  );

  const markRead = useCallback(
    (mailIds: string[], unread: boolean) => {
      void mailApi
        .markRead(mailIds, !unread)
        .then(() => {
          if (!unread) rememberRead(mailIds);
          setMails((prev) =>
            prev.map((m) => (mailIds.includes(m.id) ? { ...m, unread } : m)),
          );
          if (isWailsDesktop()) void refreshCounts();
        })
        .catch(() => undefined);
    },
    [refreshCounts, rememberRead, setMails],
  );

  const moveMails = useCallback(
    (mailIds: string[], target: FolderId, extra?: Partial<MailItem>) => {
      setMails((prev) =>
        isWailsDesktop() && target !== activeFolder
          ? prev.filter((m) => !mailIds.includes(m.id))
          : prev.map((m) =>
              mailIds.includes(m.id) ? { ...m, folder: target, ...extra } : m,
            ),
      );
      setCheckedIds((prev) => prev.filter((id) => !mailIds.includes(id)));
      if (target !== "snoozed") {
        void mailApi.moveToFolder(mailIds, target).then(() => refreshCounts());
      }
    },
    [activeFolder, refreshCounts, setCheckedIds, setMails],
  );

  const permanentDelete = useCallback(
    (mailIds: string[]) => {
      setMails((prev) => prev.filter((m) => !mailIds.includes(m.id)));
      setCheckedIds((prev) => prev.filter((id) => !mailIds.includes(id)));
      void mailApi.deletePermanently(mailIds).then(() => refreshCounts());
    },
    [refreshCounts, setCheckedIds, setMails],
  );

  const emptyTrash = useCallback(() => {
    setMails((prev) => prev.filter((m) => m.folder !== "trash"));
    setCheckedIds([]);
    void mailApi.emptyTrash().then(() => refreshCounts());
  }, [refreshCounts, setCheckedIds, setMails]);

  const updateMail = useCallback(
    (id: string, patch: Partial<MailItem>) =>
      setMails((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    [setMails],
  );

  const addMail = useCallback(
    (item: MailItem) => {
      setMails((p) => [item, ...p.filter((mail) => mail.id !== item.id)]);
      setSelectedMailId(item.id);
      if (item.unread) markRead([item.id], false);
    },
    [markRead, setMails, setSelectedMailId],
  );

  const toggleChecked = useCallback(
    (id: string) =>
      setCheckedIds((p) =>
        p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
      ),
    [setCheckedIds],
  );

  const clearChecked = useCallback(() => setCheckedIds([]), [setCheckedIds]);
  const openMail = useCallback(
    (id: string) => {
      setSelectedMailId(id);
      const unreadId = openedUnreadId(mails, id);
      if (unreadId) markRead([unreadId], false);
    },
    [mails, markRead, setSelectedMailId],
  );

  return {
    openMail,
    toggleChecked,
    clearChecked,
    toggleStar,
    markRead,
    moveMails,
    permanentDelete,
    emptyTrash,
    updateMail,
    addMail,
  };
}

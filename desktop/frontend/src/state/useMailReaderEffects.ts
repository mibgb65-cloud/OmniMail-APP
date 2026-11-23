import { useEffect, type Dispatch, type SetStateAction } from "react";
import { mailApi } from "../services/backendClient";
import type { MailItem } from "../types/mail";
import { isWailsDesktop } from "./storageHelpers";

export function useMailReaderEffects(
  selectedMail: MailItem | null,
  blockRemoteImages: boolean,
  setMails: Dispatch<SetStateAction<MailItem[]>>,
  refreshCounts: () => Promise<void>,
) {
  useEffect(() => {
    if (!isWailsDesktop() || !selectedMail?.id) return;
    const targetId = selectedMail.id;
    let alive = true;
    void mailApi
      .getThreadDetail(targetId)
      .then((detail) => {
        if (!alive || !detail) return;
        setMails((p) =>
          p.map((m) =>
            m.id === targetId ? { ...m, ...detail, id: targetId } : m,
          ),
        );
      })
      .catch(() => undefined);

    let readTimer: number | null = null;
    if (selectedMail.unread) {
      readTimer = window.setTimeout(() => {
        setMails((p) =>
          p.map((m) => (m.id === targetId ? { ...m, unread: false } : m)),
        );
        void mailApi.markRead([targetId], true).then(() => refreshCounts());
      }, 600);
    }
    return () => {
      alive = false;
      if (readTimer !== null) window.clearTimeout(readTimer);
    };
  }, [
    blockRemoteImages,
    refreshCounts,
    selectedMail?.id,
    selectedMail?.unread,
    setMails,
  ]);
}

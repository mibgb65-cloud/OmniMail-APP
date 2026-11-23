import { useEffect, type Dispatch, type SetStateAction } from "react";
import { mailApi } from "../services/backendClient";
import type { MailItem } from "../types/mail";
import { isWailsDesktop } from "./storageHelpers";

export function useMailReaderEffects(
  selectedMail: MailItem | null,
  blockRemoteImages: boolean,
  setMails: Dispatch<SetStateAction<MailItem[]>>,
) {
  const targetId = selectedMail?.id;
  useEffect(() => {
    if (!isWailsDesktop() || !targetId) return;
    let alive = true;
    void mailApi
      .getThreadDetail(targetId)
      .then((detail) => {
        if (!alive || !detail) return;
        setMails((p) =>
          p.map((m) =>
            m.id === targetId
              ? { ...m, ...detail, id: targetId, unread: m.unread }
              : m,
          ),
        );
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [blockRemoteImages, targetId, setMails]);
}

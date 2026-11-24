import { useCallback, useState, type RefObject } from "react";
import { useI18n } from "../../../i18n";
import { parseBackendError } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import type { LightboxImageItem } from "../../../types/ui";
import { copyLightboxImage, saveLightboxImage } from "./lightboxActions";

export function useLightboxActions(
  current: LightboxImageItem | undefined,
  imgRef: RefObject<HTMLImageElement | null>,
) {
  const { t } = useI18n();
  const { toastStore } = useApp();
  const [busyCopy, setBusyCopy] = useState(false);
  const [busySave, setBusySave] = useState(false);

  const handleCopy = useCallback(() => {
    if (!current || busyCopy) return;
    setBusyCopy(true);
    void copyLightboxImage(current.src, imgRef.current)
      .then(() =>
        toastStore.pushToast({
          tone: "success",
          title: t("imageLightbox.copiedImageToast"),
        }),
      )
      .catch((err) =>
        toastStore.pushToast({
          tone: "warning",
          title: t("imageLightbox.copyImageFailedToast"),
          detail: parseBackendError(err).message,
        }),
      )
      .finally(() => setBusyCopy(false));
  }, [busyCopy, current, imgRef, t, toastStore]);

  const handleSave = useCallback(() => {
    if (!current || busySave) return;
    setBusySave(true);
    void saveLightboxImage(current, imgRef.current)
      .then((savedPath) => {
        if (!savedPath) return;
        toastStore.pushToast({
          tone: "success",
          title: t("imageLightbox.savedImageToast", { name: current.name }),
          detail: savedPath,
        });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("imageLightbox.saveImageFailedToast"),
          detail: parseBackendError(err).message,
        }),
      )
      .finally(() => setBusySave(false));
  }, [busySave, current, imgRef, t, toastStore]);

  return { busyCopy, busySave, handleCopy, handleSave };
}

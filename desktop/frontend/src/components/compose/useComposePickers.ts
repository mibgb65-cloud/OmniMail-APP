import type { RefObject } from "react";
import { useI18n } from "../../i18n";
import { composeApi, parseBackendError } from "../../services/backendClient";
import {
  composeMediaApi,
  MAX_TOTAL_ATTACHMENTS_BYTES,
} from "../../services/composeMediaApi";
import { useApp } from "../../state/AppContext";
import { isWailsDesktop } from "../../state/storageHelpers";
import { buildDemoDraftAttachment } from "./ComposeAttachmentsBar";

export function useComposePickers(
  fileInputRef: RefObject<HTMLInputElement | null>,
  onSaveSelection: () => void,
  onInsertInlineImage: (
    url: string,
    contentId: string,
    filename: string,
  ) => void,
) {
  const { composeStore, toastStore } = useApp();
  const { t } = useI18n();
  const draft = composeStore.draft;

  const handlePickAttachments = () => {
    if (!draft) return;
    if (!isWailsDesktop()) {
      composeStore.updateDraft({
        attachments: [...draft.attachments, buildDemoDraftAttachment(false)],
      });
      return;
    }
    void composeApi
      .pickAttachments()
      .then((picked) => {
        if (!picked.length) return;
        const merged = [...draft.attachments, ...picked];
        const total = merged.reduce((s, a) => s + (a.sizeBytes ?? 0), 0);
        if (total > MAX_TOTAL_ATTACHMENTS_BYTES) {
          toastStore.pushToast({
            tone: "warning",
            title: t("toasts.attExceeds25MbTitle"),
            detail: t("toasts.attExceeds25MbDetail"),
          });
        }
        composeStore.updateDraft({ attachments: merged });
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "danger",
          title: t("toasts.readLocalAttFailed"),
          detail: parseBackendError(err).message,
        }),
      );
  };

  const handlePickImages = () => {
    if (!draft) return;
    onSaveSelection();
    if (!isWailsDesktop()) {
      fileInputRef.current?.click();
      return;
    }
    void composeMediaApi
      .pickAndSaveInlineImages(draft.id)
      .then((items) => {
        for (const img of items) {
          onInsertInlineImage(img.url, img.contentId, img.filename);
        }
      })
      .catch((err) =>
        toastStore.pushToast({
          tone: "warning",
          title: t("compose.inlineImageUploadFailed"),
          detail: parseBackendError(err).message,
        }),
      );
  };

  const handleBrowserImageFiles = (files: FileList | null) => {
    if (!draft || !files || files.length === 0) return;
    void Promise.all(
      Array.from(files).map(async (file) => {
        try {
          const img = await composeMediaApi.saveDraftInlineImage(
            draft.id,
            file,
          );
          onInsertInlineImage(img.url, img.contentId, img.filename);
        } catch (err) {
          toastStore.pushToast({
            tone: "warning",
            title: t("compose.inlineImageUploadFailed"),
            detail: parseBackendError(err).message,
          });
        }
      }),
    );
  };

  return { handlePickAttachments, handlePickImages, handleBrowserImageFiles };
}

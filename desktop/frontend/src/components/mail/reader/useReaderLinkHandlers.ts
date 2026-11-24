import { useCallback } from "react";
import { useI18n } from "../../../i18n";
import { mailApi } from "../../../services/backendClient";
import { useApp } from "../../../state/AppContext";
import { openSafeExternalUrl } from "../../../state/desktopActions";
import { isWailsDesktop, parseMailtoUrl } from "../../../state/storageHelpers";
import type { AttachmentItem } from "../../../types/mail";
import type { LightboxImageItem } from "../../../types/ui";
import {
  canBypassExternalLinkConfirm,
  inspectExternalLink,
} from "./externalLinkGuard";
import {
  mergeMailLightboxGallery,
  normalizeImageKey,
} from "./mailImageGallery";

export function useReaderLinkHandlers(mailDanger: boolean) {
  const { workspace, composeStore } = useApp();
  const { openNewCompose, updateDraft } = composeStore;
  const { activeProfileId, setOverlay } = workspace;

  const onMailto = useCallback(
    (url: string) => {
      const p = parseMailtoUrl(url);
      openNewCompose(p.to);
      if (p.subject || p.body) {
        updateDraft({
          ...(p.subject ? { subject: p.subject } : {}),
          ...(p.body ? { body: p.body } : {}),
        });
      }
    },
    [openNewCompose, updateDraft],
  );

  const onExternalLink = useCallback(
    ({ url, displayText }: { url: string; displayText: string }) => {
      const info = inspectExternalLink(url, { displayText, mailDanger });
      if (!info) return;
      if (canBypassExternalLinkConfirm(info, activeProfileId)) {
        void openSafeExternalUrl(info.fullUrl);
        return;
      }
      setOverlay({
        type: "external-link",
        url: info.fullUrl,
        displayText: info.displayText || undefined,
        mailDanger,
      });
    },
    [activeProfileId, mailDanger, setOverlay],
  );

  return { onMailto, onExternalLink };
}

export function useReaderImageHandlers(attachments: AttachmentItem[]) {
  const { t } = useI18n();
  const { workspace } = useApp();
  const { setOverlay } = workspace;

  const onOpenImage = useCallback(
    (bodyImages: LightboxImageItem[], activeIndex: number) => {
      const clicked = bodyImages[activeIndex];
      const merged = mergeMailLightboxGallery(bodyImages, attachments, {
        body: t("imageLightbox.sourceInlineBody"),
        attachment: t("imageLightbox.sourceAttachment"),
      });
      const clickedKey = clicked
        ? normalizeImageKey(clicked.src, clicked.attachmentId)
        : "";
      const nextIdx = Math.max(
        0,
        merged.findIndex(
          (item) =>
            normalizeImageKey(item.src, item.attachmentId) === clickedKey,
        ),
      );
      setOverlay({
        type: "image-lightbox",
        images: merged,
        initialIndex: nextIdx,
      });
    },
    [attachments, setOverlay, t],
  );

  const onRetryInlineCid = useCallback(async (attId: string) => {
    if (isWailsDesktop()) {
      await mailApi.downloadAttachment(attId);
    }
  }, []);

  return { onOpenImage, onRetryInlineCid };
}

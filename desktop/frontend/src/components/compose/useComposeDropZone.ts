import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { parseBackendError } from "../../services/backendClient";
import {
  composeMediaApi,
  MAX_INLINE_IMAGE_BYTES,
  MAX_TOTAL_ATTACHMENTS_BYTES,
} from "../../services/composeMediaApi";
import type { ComposeDraftState } from "../../types/settings";

interface UseComposeDropZoneArgs {
  draft: ComposeDraftState | null;
  updateDraft: (patch: Partial<ComposeDraftState>) => void;
  pushToast: (toast: {
    tone: "info" | "success" | "warning" | "danger";
    title: string;
    detail?: string;
  }) => void;
  onInsertInlineImage: (
    url: string,
    contentId: string,
    filename: string,
  ) => void;
}

function hasFileTransfer(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types ?? []).includes("Files");
}

export function useComposeDropZone({
  draft,
  updateDraft,
  pushToast,
  onInsertInlineImage,
}: UseComposeDropZoneArgs) {
  const { t } = useI18n();
  const dragDepthRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [shiftInline, setShiftInline] = useState(false);

  const uploadInlineImageFile = useCallback(
    (file: File) => {
      if (!draft) return;
      if (file.size > MAX_INLINE_IMAGE_BYTES) {
        pushToast({
          tone: "warning",
          title: t("compose.inlineImageTooLarge"),
        });
        return;
      }
      void composeMediaApi
        .saveDraftInlineImage(draft.id, file)
        .then((res) =>
          onInsertInlineImage(res.url, res.contentId, res.filename),
        )
        .catch((err) =>
          pushToast({
            tone: "warning",
            title: t("compose.inlineImageUploadFailed"),
            detail: parseBackendError(err).message,
          }),
        );
    },
    [draft, onInsertInlineImage, pushToast, t],
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragging(true);
    setShiftInline(e.shiftKey);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setShiftInline(e.shiftKey);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFileTransfer(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragging(false);
      setShiftInline(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      dragDepthRef.current = 0;
      setDragging(false);
      setShiftInline(false);
      if (!hasFileTransfer(e.dataTransfer) || !draft) return;
      e.preventDefault();

      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length === 0) return;

      const inlineTargets = e.shiftKey
        ? files.filter((f) => f.type.startsWith("image/"))
        : [];
      const attachmentTargets = e.shiftKey
        ? files.filter((f) => !f.type.startsWith("image/"))
        : files;

      inlineTargets.forEach(uploadInlineImageFile);
      if (attachmentTargets.length === 0) return;

      void (async () => {
        const added: ComposeDraftState["attachments"] = [];
        for (const file of attachmentTargets) {
          try {
            const saved = await composeMediaApi.saveDraftAttachmentFile(
              draft.id,
              file,
            );
            added.push(saved);
          } catch (err) {
            pushToast({
              tone: "danger",
              title: t("compose.dropAttachmentFailed"),
              detail: parseBackendError(err).message,
            });
          }
        }
        if (added.length === 0) return;
        const merged = [...draft.attachments, ...added];
        const total = merged.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0);
        if (total > MAX_TOTAL_ATTACHMENTS_BYTES) {
          pushToast({
            tone: "warning",
            title: t("toasts.attExceeds25MbTitle"),
            detail: t("toasts.attExceeds25MbDetail"),
          });
        }
        updateDraft({ attachments: merged });
      })();
    },
    [draft, pushToast, t, updateDraft, uploadInlineImageFile],
  );

  return {
    dragging,
    shiftInline,
    uploadInlineImageFile,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}

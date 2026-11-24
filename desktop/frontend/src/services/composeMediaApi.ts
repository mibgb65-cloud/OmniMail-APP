import * as DesktopService from "../../bindings/omnimail/desktopservice";
import type { DraftInlineImageDTO } from "../../bindings/omnimail/internal/outbox/models";
import * as ComposeService from "../../bindings/omnimail/services/composeservice";
import { t } from "../i18n";
import { isWailsDesktop } from "../state/storageHelpers";
import type { ComposeDraftState } from "../types/settings";

export const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENTS_BYTES = 25 * 1024 * 1024;

export type DraftInlineImageResult = {
  attachmentId: string;
  contentId: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export function formatFileBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(bytes)} B`;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error(t("compose.readFileFailed")));
    reader.readAsDataURL(file);
  });
}

function mapInlineDto(raw: DraftInlineImageDTO): DraftInlineImageResult {
  return {
    attachmentId: raw.attachmentId,
    contentId: raw.contentId,
    url: raw.url,
    filename: raw.filename,
    mimeType: raw.mimeType,
    sizeBytes: raw.sizeBytes,
  };
}

export const composeMediaApi = {
  async saveDraftInlineImage(
    draftId: string,
    file: File,
  ): Promise<DraftInlineImageResult> {
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      throw new Error(t("compose.inlineImageTooLarge"));
    }
    if (!isWailsDesktop()) {
      const id = `dimg-preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return {
        attachmentId: id,
        contentId: `${id}@omnimail.local`,
        url: URL.createObjectURL(file),
        filename: file.name || "pasted-image.png",
        mimeType: file.type || "image/png",
        sizeBytes: file.size,
      };
    }
    const b64 = await readFileAsBase64(file);
    const res = await ComposeService.SaveDraftInlineImage(
      draftId,
      file.name || "pasted-image.png",
      file.type || "image/png",
      b64,
    );
    return mapInlineDto(res);
  },

  async pickAndSaveInlineImages(
    draftId: string,
  ): Promise<DraftInlineImageResult[]> {
    if (!isWailsDesktop()) {
      return [];
    }
    const picked = await DesktopService.PickLocalImages(
      t("compose.pickInlineImageTitle"),
      true,
    );
    const results: DraftInlineImageResult[] = [];
    for (const item of picked ?? []) {
      const saved = await ComposeService.SaveDraftInlineImageFromPath(
        draftId,
        item.path,
      );
      results.push(mapInlineDto(saved));
    }
    return results;
  },

  async saveDraftAttachmentFile(
    draftId: string,
    file: File,
  ): Promise<ComposeDraftState["attachments"][number]> {
    if (!isWailsDesktop()) {
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        sizeBytes: file.size,
        sizeText: formatFileBytes(file.size),
        mimeType: file.type || "application/octet-stream",
        status: "ready",
      };
    }
    const b64 = await readFileAsBase64(file);
    const saved = await ComposeService.SaveDraftAttachmentBytes(
      draftId,
      file.name,
      file.type || "application/octet-stream",
      b64,
    );
    return {
      id: saved.id,
      name: saved.name,
      sizeBytes: saved.sizeBytes,
      sizeText: saved.sizeText,
      filePath: saved.filePath,
      mimeType: saved.mimeType,
      status: "ready",
    };
  },
};

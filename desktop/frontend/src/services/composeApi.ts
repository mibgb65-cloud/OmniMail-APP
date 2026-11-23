import * as DesktopService from "../../bindings/omnimail/desktopservice";
import type {
  ComposeDraftState as BackendDraftDTO,
  CreateDraftRequest,
  OutboxJobDTO,
  SendDraftRequest,
} from "../../bindings/omnimail/internal/outbox/models";
import * as ComposeService from "../../bindings/omnimail/services/composeservice";
import { isWailsDesktop } from "../state/storageHelpers";
import type { ComposeDraftState } from "../types/settings";

export type { CreateDraftRequest, OutboxJobDTO, SendDraftRequest };

function mapDraftDTO(raw: BackendDraftDTO): ComposeDraftState {
  const mode =
    raw.mode === "reply" || raw.mode === "reply-all" || raw.mode === "forward"
      ? raw.mode
      : "new";
  return {
    id: raw.id,
    mode,
    minimized: Boolean(raw.minimized),
    accountId: raw.accountId,
    lockedAccount: Boolean(raw.lockedAccount),
    unlockIdentity: raw.unlockIdentity,
    to: raw.to ?? [],
    cc: raw.cc ?? [],
    bcc: raw.bcc ?? [],
    showCcBcc: Boolean(
      raw.showCcBcc || (raw.cc?.length ?? 0) > 0 || (raw.bcc?.length ?? 0) > 0,
    ),
    subject: raw.subject ?? "",
    body: raw.body ?? "",
    bodyHtml: raw.bodyHtml,
    attachments: (raw.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      sizeText: a.sizeText,
      sizeBytes: a.sizeBytes,
      filePath: a.filePath,
      mimeType: a.mimeType,
      status:
        a.status === "uploading" || a.status === "failed" ? a.status : "ready",
      error: a.error,
    })),
    savedAt: raw.savedAt || "刚刚",
    scheduledAt: raw.scheduledAt,
    scheduledAtUnixMs: raw.scheduledAtUnixMs,
    replyToMailId: raw.replyToMailId,
    inlineAiOpen: Boolean(raw.inlineAiOpen),
  };
}

export const composeApi = {
  async createDraft(
    req: Partial<CreateDraftRequest> & { mode: string },
  ): Promise<ComposeDraftState | null> {
    if (!isWailsDesktop()) return null;
    const res = await ComposeService.CreateDraft({
      mode: req.mode,
      accountId: req.accountId ?? "",
      replyToMailId: req.replyToMailId ?? "",
      prefillTo: req.prefillTo ?? [],
      subject: req.subject ?? "",
      body: req.body ?? "",
    });
    return mapDraftDTO(res);
  },

  async saveDraft(draft: ComposeDraftState): Promise<ComposeDraftState> {
    if (!isWailsDesktop()) {
      return { ...draft, savedAt: new Date().toTimeString().slice(0, 5) };
    }
    const res = await ComposeService.SaveDraft({
      ...draft,
      bodyHtml: draft.bodyHtml ?? "",
      scheduledAt: draft.scheduledAt ?? "",
      scheduledAtUnixMs: draft.scheduledAtUnixMs ?? 0,
      replyToMailId: draft.replyToMailId ?? "",
      updatedAtUnixMs: Date.now(),
      attachments: draft.attachments.map((a) => ({
        id: a.id,
        name: a.name,
        sizeText: a.sizeText,
        sizeBytes: a.sizeBytes ?? 0,
        filePath: a.filePath ?? "",
        mimeType: a.mimeType ?? "",
        status: a.status,
        error: a.error ?? "",
      })),
    });
    return mapDraftDTO(res);
  },

  async getDraft(draftId: string): Promise<ComposeDraftState | null> {
    if (!isWailsDesktop()) return null;
    const res = await ComposeService.GetDraft(draftId);
    return mapDraftDTO(res);
  },

  async deleteDraft(draftId: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await ComposeService.DeleteDraft(draftId);
  },

  async sendDraft(req: {
    draft: ComposeDraftState;
    scheduledAtUnixMs?: number;
    unlockIdentity?: boolean;
    bypassUndoWindow?: boolean;
  }): Promise<OutboxJobDTO | null> {
    if (!isWailsDesktop()) return null;
    const saved = await composeApi.saveDraft(req.draft);
    return ComposeService.SendDraft({
      draftId: saved.id,
      scheduledAtUnixMs: req.scheduledAtUnixMs ?? saved.scheduledAtUnixMs ?? 0,
      unlockIdentity: Boolean(req.unlockIdentity ?? saved.unlockIdentity),
      bypassUndoWindow: Boolean(req.bypassUndoWindow),
    });
  },

  async undoSend(jobId: string): Promise<ComposeDraftState | null> {
    if (!isWailsDesktop()) return null;
    const res = await ComposeService.UndoSend(jobId);
    return mapDraftDTO(res);
  },

  async sendNow(jobId: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await ComposeService.SendNow(jobId);
  },

  async retryOutboxJob(jobOrMailId: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await ComposeService.RetryOutboxJob(jobOrMailId);
  },

  async cancelOutboxJob(jobOrMailId: string): Promise<void> {
    if (!isWailsDesktop()) return;
    await ComposeService.CancelOutboxJob(jobOrMailId);
  },

  async pickAttachments(): Promise<ComposeDraftState["attachments"]> {
    if (!isWailsDesktop()) return [];
    const files = await DesktopService.PickLocalFiles("选择邮件附件", true);
    return (files ?? []).map((f, idx) => ({
      id: `att-${Date.now()}-${idx}`,
      name: f.name,
      sizeBytes: f.sizeBytes,
      sizeText: f.sizeText,
      filePath: f.path,
      status: "ready" as const,
    }));
  },
};

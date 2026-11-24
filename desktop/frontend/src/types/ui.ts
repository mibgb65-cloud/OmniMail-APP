import type { ProviderId } from "./account";
import type { AttachmentItem } from "./mail";
import type { MailAiAction } from "./mailAi";
import type { SettingsTabId } from "./settings";

export type WorkspaceScreen = "mail" | "contacts" | "onboarding";

export type RuntimeBannerMode =
  "none" | "offline" | "auth-expired" | "auto-reply" | "partial-sync";

export type DangerConfirmKind =
  | "remove-account"
  | "delete-profile"
  | "empty-trash"
  | "permanent-delete"
  | "discard-draft"
  | "delete-label"
  | "wipe-local-data"
  | "no-subject-send";

export type UpdateStage =
  "checking" | "available" | "downloading" | "failed" | "ready";

export interface LightboxImageItem {
  id: string;
  src: string;
  name: string;
  sourceLabel?: string;
  attachmentId?: string;
  width?: number;
  height?: number;
}

export type OverlayModal =
  | { type: "none" }
  | { type: "settings"; tab: SettingsTabId; accountId?: string }
  | { type: "command-palette" }
  | { type: "advanced-search" }
  | { type: "add-account" }
  | { type: "provider-guide"; provider: ProviderId }
  | {
      type: "oauth-flow";
      provider: ProviderId;
      stage: "waiting" | "incomplete";
    }
  | { type: "manual-imap" }
  | {
      type: "sync-progress";
      accountId: string;
      accountName: string;
    }
  | {
      type: "profile-manage";
      mode?: "switch" | "create" | "unlock";
      targetProfileId?: string;
    }
  | { type: "legal-doc"; doc: "terms" | "privacy" }
  | {
      type: "ai-consent";
      actionLabel: string;
      action: MailAiAction;
      mailId: string;
      profileId: string;
    }
  | { type: "snooze"; mailIds: string[] }
  | {
      type: "label-manage";
      mailIds?: string[];
      mode?: "assign" | "create" | "rename";
      labelId?: string;
    }
  | { type: "move-folder"; mailIds: string[] }
  | { type: "schedule-send"; draftId: string }
  | {
      type: "attachment-preview";
      attachment: AttachmentItem;
      mailSubject: string;
    }
  | {
      type: "image-lightbox";
      images: LightboxImageItem[];
      initialIndex: number;
    }
  | { type: "attachment-transfer"; mode: "transfer" | "oversized" }
  | { type: "mail-source"; mailId: string }
  | { type: "print-export"; mailId: string }
  | {
      type: "external-link";
      url: string;
      displayText?: string;
      mailDanger?: boolean;
    }
  | { type: "rule-editor"; ruleId?: string }
  | { type: "account-server"; accountId: string }
  | { type: "diagnostics"; accountId: string }
  | { type: "backup-migration" }
  | { type: "data-dir-migrate" }
  | { type: "contact-edit"; contactId?: string }
  | { type: "contact-duplicates"; mode: "review" | "confirm-all" }
  | {
      type: "danger-confirm";
      kind: DangerConfirmKind;
      targetId?: string;
      targetLabel?: string;
    }
  | { type: "update-flow"; stage: UpdateStage }
  | { type: "desktop-extras"; tab: "tray" | "notifications" };

export interface ToastNotice {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  exiting?: boolean;
}

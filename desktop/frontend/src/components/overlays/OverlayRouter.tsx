import { useApp } from "../../state/AppContext";
import { useValuePresence } from "../../state/usePresence";
import type { OverlayModal } from "../../types/ui";
import { AiConsentModal } from "../ai/AiConsentModal";
import { ScheduleSendModal } from "../compose/ScheduleSendModal";
import { ContactEditModal } from "../contacts/ContactEditModal";
import { DuplicateModal } from "../contacts/duplicates/DuplicateModal";
import { AddAccountModal } from "../onboarding/AddAccountModal";
import { LegalDocModal } from "../onboarding/LegalDocModal";
import { ManualImapModal } from "../onboarding/ManualImapModal";
import { OAuthFlowModal } from "../onboarding/OAuthFlowModal";
import { ProviderGuideModal } from "../onboarding/ProviderGuideModal";
import { SyncProgressModal } from "../onboarding/SyncProgressModal";
import { SettingsModal } from "../settings/SettingsModal";
import { AdvancedSearchModal } from "./AdvancedSearchModal";
import {
  AttachmentPreviewModal,
  AttachmentTransferModal,
} from "./AttachmentModals";
import { BackupMigrationModal } from "./BackupMigrationModal";
import { CommandPaletteModal } from "./CommandPaletteModal";
import { DangerConfirmModal } from "./DangerConfirmModal";
import { DataDirMigrateModal } from "./DataDirMigrateModal";
import { DesktopExtrasModal } from "./DesktopExtrasModal";
import { ExternalLinkConfirmModal } from "./ExternalLinkConfirmModal";
import { ImageLightboxModal } from "./lightbox/ImageLightboxModal";
import { LabelManageModal } from "./LabelManageModal";
import { MailSourceModal, PrintExportModal } from "./MailMetaModals";
import { MoveFolderModal } from "./MoveFolderModal";
import { AccountServerModal, DiagnosticsModal } from "./OpsModals";
import { ProfileManageModal } from "./ProfileManageModal";
import { RuleEditorModal } from "./RuleEditorModal";
import { SnoozeModal } from "./SnoozeModal";
import { UpdateFlowModal } from "./UpdateFlowModal";

function renderModal(ov: Exclude<OverlayModal, { type: "none" }>) {
  switch (ov.type) {
    case "settings":
      return (
        <SettingsModal initialTab={ov.tab} initialAccountId={ov.accountId} />
      );
    case "command-palette":
      return <CommandPaletteModal />;
    case "advanced-search":
      return <AdvancedSearchModal />;
    case "add-account":
      return <AddAccountModal />;
    case "provider-guide":
      return <ProviderGuideModal provider={ov.provider} />;
    case "oauth-flow":
      return <OAuthFlowModal provider={ov.provider} stage={ov.stage} />;
    case "manual-imap":
      return <ManualImapModal />;
    case "sync-progress":
      return (
        <SyncProgressModal
          accountId={ov.accountId}
          accountName={ov.accountName}
        />
      );
    case "profile-manage":
      return (
        <ProfileManageModal
          initialMode={ov.mode}
          targetProfileId={ov.targetProfileId}
        />
      );
    case "legal-doc":
      return <LegalDocModal doc={ov.doc} />;
    case "ai-consent":
      return (
        <AiConsentModal
          actionLabel={ov.actionLabel}
          action={ov.action}
          mailId={ov.mailId}
          profileId={ov.profileId}
        />
      );
    case "snooze":
      return <SnoozeModal mailIds={ov.mailIds} />;
    case "label-manage":
      return <LabelManageModal mailIds={ov.mailIds} />;
    case "move-folder":
      return <MoveFolderModal mailIds={ov.mailIds} />;
    case "schedule-send":
      return <ScheduleSendModal />;
    case "attachment-preview":
      return (
        <AttachmentPreviewModal
          attachment={ov.attachment}
          mailSubject={ov.mailSubject}
        />
      );
    case "image-lightbox":
      return (
        <ImageLightboxModal images={ov.images} initialIndex={ov.initialIndex} />
      );
    case "attachment-transfer":
      return <AttachmentTransferModal mode={ov.mode} />;
    case "mail-source":
      return <MailSourceModal mailId={ov.mailId} />;
    case "print-export":
      return <PrintExportModal mailId={ov.mailId} />;
    case "external-link":
      return (
        <ExternalLinkConfirmModal
          url={ov.url}
          displayText={ov.displayText}
          mailDanger={ov.mailDanger}
        />
      );
    case "rule-editor":
      return <RuleEditorModal ruleId={ov.ruleId} />;
    case "account-server":
      return <AccountServerModal accountId={ov.accountId} />;
    case "diagnostics":
      return <DiagnosticsModal accountId={ov.accountId} />;
    case "backup-migration":
      return <BackupMigrationModal />;
    case "data-dir-migrate":
      return <DataDirMigrateModal />;
    case "contact-edit":
      return <ContactEditModal contactId={ov.contactId} />;
    case "contact-duplicates":
      return <DuplicateModal key={ov.mode} mode={ov.mode} />;
    case "danger-confirm":
      return (
        <DangerConfirmModal
          kind={ov.kind}
          targetId={ov.targetId}
          targetLabel={ov.targetLabel}
        />
      );
    case "update-flow":
      return <UpdateFlowModal stage={ov.stage} />;
    case "desktop-extras":
      return <DesktopExtrasModal tab={ov.tab} />;
  }
}

export function OverlayRouter() {
  const { workspace } = useApp();
  const active = workspace.overlay.type === "none" ? null : workspace.overlay;
  const { rendered, closing } = useValuePresence(active, 140);
  if (!rendered) return null;

  return (
    <div
      key={rendered.type}
      className="overlay-motion-root"
      data-layer="overlay"
      data-closing={closing ? "true" : "false"}
    >
      {renderModal(rendered)}
    </div>
  );
}

import { useState } from "react";
import { useI18n, type TranslationKey } from "../../i18n";
import {
  accountApi,
  parseBackendError,
  profileApi,
} from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { DangerConfirmKind } from "../../types/ui";
import { ModalShell } from "../common/ModalShell";
import { PasswordInput } from "../common/PasswordInput";

const DANGER_KEYS: Record<
  DangerConfirmKind,
  readonly [TranslationKey, TranslationKey, TranslationKey]
> = {
  "remove-account": [
    "overlays.dangerRemoveAccTitle",
    "overlays.dangerRemoveAccDesc",
    "overlays.dangerRemoveAccConfirm",
  ],
  "delete-profile": [
    "overlays.dangerDeleteProfTitle",
    "overlays.dangerDeleteProfDesc",
    "overlays.dangerDeleteProfConfirm",
  ],
  "empty-trash": [
    "overlays.dangerEmptyTrashTitle",
    "overlays.dangerEmptyTrashDesc",
    "overlays.dangerEmptyTrashConfirm",
  ],
  "permanent-delete": [
    "overlays.dangerPermDeleteTitle",
    "overlays.dangerPermDeleteDesc",
    "overlays.dangerPermDeleteConfirm",
  ],
  "discard-draft": [
    "overlays.dangerDiscardDraftTitle",
    "overlays.dangerDiscardDraftDesc",
    "overlays.dangerDiscardDraftConfirm",
  ],
  "delete-label": [
    "overlays.dangerDeleteLabelTitle",
    "overlays.dangerDeleteLabelDesc",
    "overlays.dangerDeleteLabelConfirm",
  ],
  "wipe-local-data": [
    "overlays.dangerWipeDataTitle",
    "overlays.dangerWipeDataDesc",
    "overlays.dangerWipeDataConfirm",
  ],
  "no-subject-send": [
    "overlays.dangerNoSubjectTitle",
    "overlays.dangerNoSubjectDesc",
    "overlays.dangerNoSubjectConfirm",
  ],
};

export function DangerConfirmModal({
  kind,
  targetId,
  targetLabel,
}: {
  kind: DangerConfirmKind;
  targetId?: string;
  targetLabel?: string;
}) {
  const { workspace, mailStore, composeStore, toastStore, sendMailWithUndo } =
    useApp();
  const { t, localizeText } = useI18n();
  const [titleKey, descKey, confirmKey] = DANGER_KEYS[kind];
  const tone = kind === "no-subject-send" ? "primary" : "danger";
  const displayTarget = targetLabel ? localizeText(targetLabel) : undefined;
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const targetProf =
    kind === "delete-profile"
      ? workspace.profiles.find((p) => p.id === targetId)
      : undefined;
  const notify = (tTone: "warning" | "info", title: string) =>
    toastStore.pushToast({ tone: tTone, title });

  const handleConfirm = async () => {
    setBusy(true);
    try {
      if (kind === "remove-account" && targetId) {
        await accountApi.removeAccount(targetId);
        workspace.removeAccount(targetId);
        await workspace.refreshProfilesAndAccounts();
        notify(
          "warning",
          t("toasts.removedAccount", { target: displayTarget ?? targetId }),
        );
      } else if (kind === "delete-profile" && targetId) {
        await profileApi.deleteProfile(targetId, true, pin);
        await workspace.refreshProfilesAndAccounts();
        notify(
          "warning",
          t("toasts.deletedProfile", { target: displayTarget ?? targetId }),
        );
      } else if (kind === "empty-trash") {
        mailStore.emptyTrash();
        notify("warning", t("toasts.emptiedTrash"));
      } else if (kind === "permanent-delete" && targetId) {
        mailStore.permanentDelete(targetId.split(","));
        notify("warning", t("toasts.permDeletedMails"));
      } else if (kind === "discard-draft") {
        composeStore.discardDraft();
        void mailStore.reloadMessages();
        notify("info", t("toasts.draftDeleted"));
      } else if (kind === "delete-label" && targetId) {
        mailStore.deleteLabel(targetId);
        notify("info", t("toasts.deletedLabel", { name: displayTarget ?? "" }));
      } else if (kind === "wipe-local-data") {
        for (const a of workspace.accounts)
          await accountApi.removeAccount(a.id);
        workspace.resetLocalData();
        notify("warning", t("toasts.wipedLocalData"));
      } else if (kind === "no-subject-send" && composeStore.draft) {
        const d = composeStore.draft;
        const noSubject = t("common.noSubject");
        sendMailWithUndo({
          accountId: d.accountId,
          to: d.to,
          subject: noSubject,
          body: d.body,
          scheduledAt: d.scheduledAt,
          draft: { ...d, subject: noSubject },
        });
        composeStore.closeDraft();
      }
      workspace.setOverlay({ type: "none" });
    } catch (err) {
      toastStore.pushToast({
        tone: "danger",
        title: t("toasts.actionFailed"),
        detail: parseBackendError(err).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      heading={t(titleKey)}
      subtitle={
        displayTarget
          ? t("overlays.dangerTargetSubtitle", { target: displayTarget })
          : undefined
      }
      maxWidth={460}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <div className="row" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => workspace.setOverlay({ type: "none" })}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={busy || Boolean(targetProf?.pinEnabled && pin.length < 4)}
            className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={() => void handleConfirm()}
          >
            {busy ? t("overlays.dangerProcessingBtn") : t(confirmKey)}
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-body)" }}>
        {t(descKey)}
      </div>
      {targetProf?.pinEnabled && (
        <PasswordInput
          value={pin}
          onChange={setPin}
          placeholder={t("overlays.dangerPinPlaceholder")}
          ariaLabel={t("overlays.dangerPinAria")}
        />
      )}
    </ModalShell>
  );
}

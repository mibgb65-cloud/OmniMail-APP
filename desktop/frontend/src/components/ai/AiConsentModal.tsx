import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { profileApi } from "../../services/backendClient";
import type { MailAiAction } from "../../types/mailAi";
import { mailAiScope } from "./aiPrivacyScope";
import { Checkbox } from "../common/Checkbox";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";

export function AiConsentModal({
  actionLabel,
  action,
  mailId,
  profileId,
}: {
  actionLabel: string;
  action: MailAiAction;
  mailId: string;
  profileId: string;
}) {
  const { lang, isEn, t } = useI18n();
  const { workspace, mailStore, aiStore, toastStore } = useApp();
  const [rememberChoice, setRememberChoice] = useState(false);
  const mail = mailStore.selectedMail;
  const scope = mailAiScope(
    workspace.settings.aiIncludeSenderAndAttachments,
    lang,
  );
  const isChat = action.kind === "chat";
  const canConfirm =
    mail?.id === mailId &&
    workspace.activeProfileId === profileId &&
    workspace.settings.aiEnabled &&
    !aiStore.sensitive.has(mailId);

  const handleConfirm = () => {
    if (!mail || !canConfirm) return;
    workspace.setOverlay({ type: "none" });
    aiStore.runAction(mailId, action, true);
    if (rememberChoice) {
      const patch = { aiRequireConfirmEachTime: false };
      void profileApi
        .updateAppSettings(patch)
        .then(() => workspace.applySettingsFromBackend(patch))
        .catch(() =>
          toastStore.pushToast({
            tone: "warning",
            title: t("toasts.consentSavePrefFailed"),
          }),
        );
    }
  };
  const modelText = isEn
    ? `${workspace.settings.aiProvider} (${workspace.settings.aiModel})`
    : `${workspace.settings.aiProvider}（${workspace.settings.aiModel}）`;

  return (
    <ModalShell
      heading={t("ai.consentHeading")}
      subtitle={t("ai.consentSubtitle", { action: actionLabel })}
      maxWidth={520}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              workspace.setOverlay({ type: "settings", tab: "ai" })
            }
          >
            {t("ai.consentGoSettings")}
          </button>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {t("ai.consentConfirmBtn")}
            </button>
          </div>
        </>
      }
    >
      <div className="settings-card">
        <div
          className="row"
          style={{ color: "var(--brand-ai)", fontWeight: 700 }}
        >
          <Icon name="shield" size={16} />
          <span>{t("ai.consentScopeHeading")}</span>
        </div>
        <ul
          style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.75 }}
        >
          <li>
            <strong>{t("ai.consentIncludedLabel")}</strong>
            {scope.mailContent}
            {isChat ? t("ai.consentChatExtra") : ""}
          </li>
          <li>
            <strong>{t("ai.consentExcludedLabel")}</strong>
            {scope.notShared}
          </li>
          <li>
            <strong>{t("ai.consentModelLabel")}</strong>
            {modelText}
          </li>
        </ul>
      </div>

      <Checkbox
        checked={rememberChoice}
        onChange={setRememberChoice}
        ariaLabel={t("ai.consentRememberAria")}
      >
        {t("ai.consentRememberLabel")}
      </Checkbox>
    </ModalShell>
  );
}

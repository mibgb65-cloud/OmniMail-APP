import { useState } from "react";
import { useI18n } from "../../i18n";
import { accountApi, parseBackendError } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import {
  ACCOUNT_NAME_MAX_LEN,
  resolveConciseProviderLabel,
  resolveSidebarAccountTitle,
} from "../../utils/accountDisplay";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { AccountIdentityFields } from "./AccountIdentityFields";

export function AccountDetailView({
  accountId,
  onBack,
}: {
  accountId: string;
  onBack: () => void;
}) {
  const { workspace, toastStore } = useApp();
  const { lang, t } = useI18n();
  const detail = workspace.accounts.find((a) => a.id === accountId);
  const [displayName, setDisplayName] = useState(() =>
    detail ? resolveSidebarAccountTitle(detail, lang) : "",
  );
  const [senderName, setSenderName] = useState(detail?.senderName ?? "");
  const [replyTo, setReplyTo] = useState(detail?.replyTo ?? "");
  const [signature, setSignature] = useState(detail?.signature ?? "");
  const [saveStatus, setSaveStatus] = useState<AsyncActionStatus>("idle");

  if (!detail) return null;
  const conciseFallback = resolveConciseProviderLabel(
    detail.provider,
    detail.email,
    lang,
  );
  const pushErr = (err: unknown) =>
    toastStore.pushToast({
      tone: "danger",
      title: parseBackendError(err).message,
    });

  const saveMeta = async () => {
    setSaveStatus("loading");
    const finalName =
      displayName.trim().slice(0, ACCOUNT_NAME_MAX_LEN) || conciseFallback;
    try {
      const updated = await accountApi.updateAccount({
        id: detail.id,
        name: finalName,
        shortTag: finalName.slice(0, 10),
        senderName,
        replyTo,
        signature,
      });
      setDisplayName(finalName);
      workspace.updateAccount(detail.id, updated);
      setSaveStatus("success");
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.savedIdentitySignature"),
      });
    } catch (err) {
      setSaveStatus("error");
      pushErr(err);
    }
  };

  const makeDefault = async () => {
    try {
      await accountApi.setDefaultAccount(detail.id);
      workspace.updateSettings({ defaultSendAccountId: detail.id });
      await workspace.refreshProfilesAndAccounts();
      toastStore.pushToast({
        tone: "success",
        title: t("toasts.setDefaultSenderDone"),
      });
    } catch (err) {
      pushErr(err);
    }
  };

  const statusMeta =
    detail.status === "connected"
      ? { tone: "pill-success", text: t("settings.statusHealthy") }
      : detail.status === "auth-expired"
        ? { tone: "pill-danger", text: t("settings.statusExpired") }
        : { tone: "pill-warning", text: t("settings.statusSyncing") };
  const openOverlay = workspace.setOverlay;
  const isDefault = workspace.settings.defaultSendAccountId === detail.id;
  const headerTitle = resolveSidebarAccountTitle(detail, lang);
  const protoLine = `${detail.email} · IMAP: ${detail.imap.host}:${detail.imap.port} · SMTP: ${detail.smtp.host}:${detail.smtp.port}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="row-between">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <Icon name="arrowLeft" size={14} /> {t("settings.backToAccountsList")}
        </button>
        {!isDefault && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void makeDefault()}
          >
            {t("settings.setAsDefaultSender")}
          </button>
        )}
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div className="row" style={{ gap: 12 }}>
            <ProviderIcon provider={detail.provider} size={36} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{headerTitle}</div>
              <div className="text-xs text-muted">{protoLine}</div>
            </div>
          </div>
          <span className={`pill ${statusMeta.tone}`}>{statusMeta.text}</span>
        </div>

        <AccountIdentityFields
          detail={detail}
          conciseFallback={conciseFallback}
          displayName={displayName}
          senderName={senderName}
          replyTo={replyTo}
          signature={signature}
          onDisplayNameChange={setDisplayName}
          onSenderNameChange={setSenderName}
          onReplyToChange={setReplyTo}
          onSignatureChange={setSignature}
        />

        <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="text-xs text-muted">
            {t("settings.renameQuickTip")}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                openOverlay({ type: "account-server", accountId: detail.id })
              }
            >
              {t("settings.editServerParams")}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                openOverlay({ type: "diagnostics", accountId: detail.id })
              }
            >
              {t("settings.connDiagnostics")}
            </button>
            <AsyncActionButton
              size="sm"
              status={saveStatus}
              idleLabel={t("settings.saveIdentityIdle")}
              loadingLabel={t("settings.saveIdentityLoading")}
              successLabel={t("settings.saveIdentitySuccess")}
              errorLabel={t("settings.saveIdentityError")}
              onSuccessHoldEnd={() => setSaveStatus("idle")}
              onClick={() => void saveMeta()}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 13, color: "var(--status-danger)" }}>
              {t("settings.removeAccountTitle")}
            </strong>
            <div className="text-xs text-muted">
              {t("settings.removeAccountDesc")}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              openOverlay({
                type: "danger-confirm",
                kind: "remove-account",
                targetId: detail.id,
                targetLabel: headerTitle,
              })
            }
          >
            {t("settings.removeAccountBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

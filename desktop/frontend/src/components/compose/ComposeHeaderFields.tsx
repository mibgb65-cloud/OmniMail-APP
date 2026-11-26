import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { resolveSidebarAccountTitle } from "../../utils/accountDisplay";
import { CustomSelect } from "../common/CustomSelect";
import { Icon } from "../common/Icon";
import { ProviderIcon } from "../common/ProviderIcon";
import { RecipientInputRow } from "./RecipientInputRow";

export function ComposeHeaderFields() {
  const { workspace, composeStore, toastStore } = useApp();
  const { lang, t, formatTime } = useI18n();
  const draft = composeStore.draft;
  if (!draft) return null;

  const senderOptions = workspace.accounts.length
    ? workspace.accounts.map((acc) => ({
        value: acc.id,
        label:
          resolveSidebarAccountTitle(acc, lang) || t("topbar.accountFallback"),
        sublabel: acc.email,
        icon: <ProviderIcon provider={acc.provider} size={18} />,
      }))
    : [{ value: draft.accountId, label: t("toasts.defaultMailboxFallback") }];

  const unlockSender = () => {
    composeStore.updateDraft({ lockedAccount: false, unlockIdentity: true });
    toastStore.pushToast({
      tone: "info",
      title: t("toasts.unlockedIdentityTemp"),
    });
  };

  return (
    <>
      <div className="compose-row">
        <span className="compose-row-label">{t("compose.fromLabel")}</span>
        <div className="row" style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <CustomSelect
            compact
            showSublabelInTrigger
            value={draft.accountId}
            disabled={draft.lockedAccount}
            ariaLabel={t("compose.selectSenderAria")}
            minMenuWidth={300}
            style={{ flex: 1, maxWidth: 420 }}
            onChange={(val) => composeStore.updateDraft({ accountId: val })}
            options={senderOptions}
          />
          {draft.lockedAccount && (
            <>
              <span className="pill pill-accent">
                <Icon name="lock" size={12} />{" "}
                {t("compose.lockedOriginalAccount")}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={unlockSender}
              >
                {t("compose.unlockTemporarily")}
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            composeStore.updateDraft({ showCcBcc: !draft.showCcBcc })
          }
        >
          {draft.showCcBcc ? t("compose.hideCcBcc") : t("compose.showCcBcc")}
        </button>
      </div>

      <RecipientInputRow
        label={t("compose.toLabel")}
        values={draft.to}
        contacts={workspace.contacts}
        onChange={(next) => composeStore.updateDraft({ to: next })}
      />

      {draft.showCcBcc &&
        (["cc", "bcc"] as const).map((field) => (
          <RecipientInputRow
            key={field}
            label={t(field === "cc" ? "compose.ccLabel" : "compose.bccLabel")}
            values={draft[field]}
            contacts={workspace.contacts}
            onChange={(next) => composeStore.updateDraft({ [field]: next })}
          />
        ))}

      <div className="compose-row">
        <span className="compose-row-label">{t("compose.subjectLabel")}</span>
        <input
          type="text"
          value={draft.subject}
          onChange={(e) =>
            composeStore.updateDraft({ subject: e.target.value })
          }
          placeholder={t("compose.subjectPlaceholder")}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            color: "var(--text-ink)",
            fontSize: 14,
            fontWeight: 600,
          }}
        />
        {draft.scheduledAt && (
          <span className="pill pill-accent">
            {t("compose.scheduledBadge", {
              time: formatTime(draft.scheduledAt),
            })}
          </span>
        )}
      </div>
    </>
  );
}

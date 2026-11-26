import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { resolveSidebarAccountTitle } from "../../utils/accountDisplay";
import { CustomSelect } from "../common/CustomSelect";
import { ToggleSwitch } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";
import { FadeTextarea } from "../common/scroll-fade/FadeTextarea";
import { SwitchRow } from "./SwitchRow";

export function ComposeTab() {
  const { workspace, toastStore } = useApp();
  const { lang, t } = useI18n();
  const s = workspace.settings;
  const activeAcc =
    workspace.accounts.find((a) => a.id === s.defaultSendAccountId) ??
    workspace.accounts[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="settings-card">
        <strong style={{ fontSize: 14 }}>
          {t("settings.composeSafetyHeading")}
        </strong>
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.defaultSendAccountTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.defaultSendAccountDesc")}
            </div>
          </div>
          <CustomSelect
            value={s.defaultSendAccountId}
            ariaLabel={t("settings.defaultSendAccountTitle")}
            minMenuWidth={240}
            options={workspace.accounts.map((acc) => ({
              value: acc.id,
              label: resolveSidebarAccountTitle(acc, lang),
              sublabel: acc.email,
              icon: <ProviderIcon provider={acc.provider} size={18} />,
            }))}
            onChange={(val) =>
              workspace.updateSettings({ defaultSendAccountId: val })
            }
          />
        </div>

        <SwitchRow
          heading={t("settings.lockReplyAccountTitle")}
          desc={t("settings.lockReplyAccountDesc")}
          checked={s.lockReplyToOriginalAccount}
          onChange={(v) =>
            workspace.updateSettings({ lockReplyToOriginalAccount: v })
          }
        />

        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {t("settings.undoWindowTitle")}
            </div>
            <div className="text-xs text-muted">
              {t("settings.undoWindowDesc")}
            </div>
          </div>
          <CustomSelect
            value={s.undoSendSeconds}
            ariaLabel={t("settings.undoWindowTitle")}
            options={[
              { value: 5, label: t("settings.sec5") },
              {
                value: 10,
                label: t("settings.sec10"),
                hint: t("settings.defaultHint"),
              },
              { value: 20, label: t("settings.sec20") },
            ]}
            onChange={(val) =>
              workspace.updateSettings({
                undoSendSeconds: Number(val) as 5 | 10 | 20,
              })
            }
          />
        </div>
      </div>

      {activeAcc && (
        <div className="settings-card">
          <div className="row-between">
            <strong style={{ fontSize: 14 }}>
              {t("settings.defaultAccountSignatureHeading", {
                tag: resolveSidebarAccountTitle(activeAcc, lang),
              })}
            </strong>
            <ToggleSwitch
              checked={s.autoAppendSignature}
              ariaLabel={t("settings.autoAppendSignatureAria")}
              onChange={(v) =>
                workspace.updateSettings({ autoAppendSignature: v })
              }
            />
          </div>
          <FadeTextarea
            aria-label={t("settings.defaultSignatureAria")}
            className="textarea"
            rows={4}
            value={activeAcc.signature}
            onChange={(e) =>
              workspace.updateAccount(activeAcc.id, {
                signature: e.target.value,
              })
            }
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: "flex-end" }}
            onClick={() =>
              toastStore.pushToast({
                tone: "success",
                title: t("toasts.savedSignatureConfig"),
              })
            }
          >
            {t("settings.saveSignatureBtn")}
          </button>
        </div>
      )}
    </div>
  );
}

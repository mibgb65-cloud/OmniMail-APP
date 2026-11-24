import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Checkbox } from "../common/Checkbox";
import { CustomSelect } from "../common/CustomSelect";
import { ModalShell } from "../common/ModalShell";
import { ProviderIcon } from "../common/ProviderIcon";

export function AdvancedSearchModal() {
  const { workspace, mailStore, toastStore } = useApp();
  const { t } = useI18n();
  const [from, setFrom] = useState(mailStore.advSearch.from);
  const [subject, setSubject] = useState(mailStore.advSearch.subject);
  const [accountId, setAccountId] = useState(mailStore.advSearch.accountId);
  const [hasAttachment, setHasAttachment] = useState(
    mailStore.advSearch.hasAttachment,
  );
  const [dateRange, setDateRange] = useState(mailStore.advSearch.dateRange);

  const apply = () => {
    mailStore.setAdvSearch({
      from,
      to: mailStore.advSearch.to,
      subject,
      accountId,
      hasAttachment,
      dateRange,
    });
    workspace.setScreen("mail");
    workspace.setOverlay({ type: "none" });
    toastStore.pushToast({
      tone: "info",
      title: t("toasts.advSearchAppliedTitle"),
      detail: t("toasts.advSearchAppliedDetail"),
    });
  };

  const reset = () => {
    mailStore.resetAdvSearch();
    setFrom("");
    setSubject("");
    setAccountId("all");
    setHasAttachment(false);
    setDateRange("all");
  };

  return (
    <ModalShell
      heading={t("overlays.advSearchHeading")}
      subtitle={t("overlays.advSearchSubtitle")}
      maxWidth={520}
      onClose={() => workspace.setOverlay({ type: "none" })}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={reset}>
            {t("overlays.advResetAllBtn")}
          </button>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => workspace.setOverlay({ type: "none" })}
            >
              {t("common.cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={apply}>
              {t("overlays.advSearchNowBtn")}
            </button>
          </div>
        </>
      }
    >
      <div>
        <label className="text-xs text-muted">
          {t("overlays.advFromLabel")}
        </label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder={t("overlays.advFromPlaceholder")}
        />
      </div>

      <div>
        <label className="text-xs text-muted">
          {t("overlays.advSubjectLabel")}
        </label>
        <input
          className="input"
          style={{ marginTop: 4 }}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("overlays.advSubjectPlaceholder")}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.advAccountScopeLabel")}
          </label>
          <CustomSelect
            fullWidth
            minMenuWidth={220}
            style={{ marginTop: 4 }}
            value={accountId}
            ariaLabel={t("overlays.advAccountScopeAria")}
            options={[
              { value: "all", label: t("overlays.advAllAccountsOpt") },
              ...workspace.accounts.map((acc) => ({
                value: acc.id,
                label: acc.name,
                sublabel: acc.email,
                icon: <ProviderIcon provider={acc.provider} size={18} />,
              })),
            ]}
            onChange={setAccountId}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            {t("overlays.advDateRangeLabel")}
          </label>
          <CustomSelect
            fullWidth
            style={{ marginTop: 4 }}
            value={dateRange}
            ariaLabel={t("overlays.advDateRangeAria")}
            options={[
              { value: "all", label: t("overlays.advDateAllOpt") },
              { value: "7d", label: t("overlays.advDate7dOpt") },
              { value: "30d", label: t("overlays.advDate30dOpt") },
              { value: "90d", label: t("overlays.advDate90dOpt") },
            ]}
            onChange={(val) =>
              setDateRange(val as "all" | "7d" | "30d" | "90d")
            }
          />
        </div>
      </div>

      <Checkbox
        checked={hasAttachment}
        onChange={setHasAttachment}
        ariaLabel={t("overlays.advHasAttachmentLabel")}
      >
        {t("overlays.advHasAttachmentLabel")}
      </Checkbox>
    </ModalShell>
  );
}

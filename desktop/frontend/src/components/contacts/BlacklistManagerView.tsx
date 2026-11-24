import { useState } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

export function BlacklistManagerView() {
  const { workspace, toastStore } = useApp();
  const { t, formatTime, localizeText } = useI18n();
  const [newRule, setNewRule] = useState("");
  const [customReason, setCustomReason] = useState<string | null>(null);
  const reason = customReason ?? t("contacts.blacklistDefaultReason");

  const handleAdd = () => {
    const target = newRule.trim();
    if (!target) return;
    const isDom = target.startsWith("*@") || !target.includes("@");
    const cleanTarget = target.replace(/^\*@|^@/, "");
    workspace.addBlacklist({
      target: cleanTarget,
      kind: isDom ? "domain" : "address",
      reason: reason.trim() || t("contacts.blacklistManualFallbackReason"),
      blockedCount: 0,
      addedAt: "今天",
    });
    setNewRule("");
    toastStore.pushToast({
      tone: "success",
      title: t("toasts.addedBlockRule", { target }),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="settings-card">
        <div className="row-between">
          <div>
            <strong style={{ fontSize: 14 }}>
              {t("contacts.blacklistCardTitle")}
            </strong>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              {t("contacts.blacklistCardDesc")}
            </div>
          </div>
          <span className="pill pill-danger">
            {t("contacts.blacklistActiveCount", {
              count: workspace.blacklist.length,
            })}
          </span>
        </div>
        <div className="row" style={{ minWidth: 0 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 0 }}
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder={t("contacts.blacklistRulePlaceholder")}
          />
          <input
            className="input"
            style={{ width: 180, minWidth: 0 }}
            value={reason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder={t("contacts.blacklistNotePlaceholder")}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
            onClick={handleAdd}
          >
            <Icon name="plus" size={14} /> {t("contacts.blacklistAddBtn")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {workspace.blacklist.map((entry) => (
          <div key={entry.id} className="settings-card">
            <div className="row-between">
              <div className="row">
                <span className="pill pill-danger">
                  {entry.kind === "domain"
                    ? t("contacts.blacklistKindDomain")
                    : t("contacts.blacklistKindAddress")}
                </span>
                <strong style={{ fontSize: 14 }}>{entry.target}</strong>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  workspace.removeBlacklist(entry.id);
                  toastStore.pushToast({
                    tone: "info",
                    title: t("toasts.unblockedTarget", {
                      target: entry.target,
                    }),
                  });
                }}
              >
                {t("contacts.blacklistRemoveBtn")}
              </button>
            </div>
            <div className="row-between text-xs text-muted">
              <span>{localizeText(entry.reason)}</span>
              <span>
                {t("contacts.blacklistStatsRow", {
                  count: entry.blockedCount,
                  date: formatTime(entry.addedAt),
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

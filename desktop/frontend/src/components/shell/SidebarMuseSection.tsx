import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { resolveConciseAgentTitle } from "../../utils/agentMailFormat";
import { ProviderIcon } from "../common/ProviderIcon";
import { Tooltip } from "../common/Tooltip";

export function SidebarMuseSection({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { workspace, museStore } = useApp();
  const { t } = useI18n();
  const { status } = museStore;

  if (!status.bound || !status.verifiedEmail) {
    return null;
  }

  const active = workspace.screen === "muse";
  const displayName = resolveConciseAgentTitle(status.accountName, "muse");

  return (
    <>
      <div className="sidebar-divider" />
      <div className="nav-section">
        <div className="nav-section-head">
          <span className="truncate">{t("muse.sidebarSectionTitle")}</span>
        </div>

        <Tooltip
          label={`${displayName} · ${status.verifiedEmail}`}
          placement="right"
        >
          <button
            type="button"
            className={`account-row muse-sidebar-row ${active ? "active" : ""}`}
            aria-pressed={active}
            aria-label={t("muse.sidebarEntryAria", { name: displayName })}
            onClick={() => {
              workspace.setScreen("muse");
              if (museStore.threads.length === 0 && !museStore.listLoading) {
                void museStore.refreshThreads();
              }
              onNavigate?.();
            }}
          >
            <ProviderIcon provider="muse" size={28} />
            <div className="account-row-meta">
              <span className="account-row-name truncate">{displayName}</span>
              <span className="account-row-sub truncate">
                {status.verifiedEmail}
              </span>
            </div>
          </button>
        </Tooltip>
      </div>
    </>
  );
}

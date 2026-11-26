import { useEffect, useMemo, useState } from "react";
import { mergePickerPresets, PROVIDER_CATALOG } from "../../data/providers";
import { localizeProviderPreset, useI18n } from "../../i18n";
import { accountApi } from "../../services/backendClient";
import { useApp } from "../../state/AppContext";
import type { ProviderCatalogItem } from "../../types/account";
import { Icon } from "../common/Icon";
import { ModalShell } from "../common/ModalShell";
import { Tooltip } from "../common/Tooltip";
import {
  countProvidersByCategory,
  filterPickerDirectory,
  resolveProviderTargetOverlay,
  type PickerCategoryFilter,
} from "./addAccountCatalog";
import { AddAccountDirectory } from "./AddAccountDirectory";
import { AddAccountSidebar } from "./AddAccountSidebar";

export function AddAccountModal() {
  const { workspace } = useApp();
  const { lang, t } = useI18n();

  const [standardPresets, setStandardPresets] =
    useState<ProviderCatalogItem[]>(PROVIDER_CATALOG);
  const [activeCategory, setActiveCategory] =
    useState<PickerCategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let alive = true;
    void accountApi
      .listProviderPresets()
      .then((list) => {
        if (alive && list.length > 0) setStandardPresets(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const localizedPresets = useMemo(
    () =>
      mergePickerPresets(standardPresets).map((item) =>
        localizeProviderPreset(item, lang),
      ),
    [lang, standardPresets],
  );

  const counts = useMemo(
    () => countProvidersByCategory(localizedPresets),
    [localizedPresets],
  );

  const directory = useMemo(
    () => filterPickerDirectory(localizedPresets, activeCategory, searchQuery),
    [activeCategory, localizedPresets, searchQuery],
  );

  const handleClose = () => workspace.setOverlay({ type: "none" });
  const handleManualImap = () => workspace.setOverlay({ type: "manual-imap" });

  const headingText = t("onboarding.addAccountHeading");

  return (
    <ModalShell
      maxWidth={980}
      noPadding
      ariaLabel={headingText}
      cardClassName="pcm-modal-card aam-modal-card"
      onClose={handleClose}
      footer={
        <>
          <span className="pcm-footer-note">
            {t("onboarding.pickerFooterNote")}
          </span>
          <div className="pcm-footer-actions">
            <button
              type="button"
              className="btn pcm-btn-back"
              onClick={handleManualImap}
            >
              <Icon name="server" size={14} />
              <span>{t("onboarding.pickerManualBtn")}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost aam-btn-close"
              onClick={handleClose}
            >
              {t("common.close")}
            </button>
          </div>
        </>
      }
    >
      <div className="pcm-header">
        <div style={{ minWidth: 0 }}>
          <div className="pcm-title-row">
            <h2 className="pcm-title">{headingText}</h2>
            <span className="pcm-existing-pill">
              {t("onboarding.pickerPresetBadge", { count: counts.total })}
            </span>
          </div>
          <p className="pcm-subtitle">{t("onboarding.pickerSubtitle")}</p>
        </div>

        <Tooltip label={t("common.closeModal")} shortcut="Esc">
          <button
            type="button"
            className="icon-btn pcm-close-btn"
            onClick={handleClose}
            aria-label={t("common.closeModal")}
          >
            <Icon name="x" size={15} />
          </button>
        </Tooltip>
      </div>

      <div className="aam-layout">
        <AddAccountSidebar
          activeCategory={activeCategory}
          counts={counts}
          onSelectCategory={setActiveCategory}
          onOpenManualImap={handleManualImap}
        />

        <AddAccountDirectory
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          directory={directory}
          onSearchChange={setSearchQuery}
          onSelectProvider={(item) =>
            workspace.setOverlay(resolveProviderTargetOverlay(item))
          }
          onSelectOAuthProvider={(provider) =>
            workspace.setOverlay({
              type: "oauth-flow",
              provider,
              stage: "waiting",
            })
          }
          onOpenManualImap={handleManualImap}
        />
      </div>
    </ModalShell>
  );
}

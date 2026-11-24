import { useI18n } from "../../i18n";
import { Icon } from "../common/Icon";

interface ComposeDropOverlayProps {
  visible: boolean;
  inlineMode: boolean;
}

export function ComposeDropOverlay({
  visible,
  inlineMode,
}: ComposeDropOverlayProps) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <div className="compose-drop-overlay" aria-live="polite">
      <div className="compose-drop-card">
        <div className="compose-drop-icon">
          <Icon name={inlineMode ? "image" : "upload"} size={24} />
        </div>
        <div className="compose-drop-title">
          {inlineMode
            ? t("compose.dropOverlayInlineTitle")
            : t("compose.dropOverlayTitle")}
        </div>
        <div className="compose-drop-hint">{t("compose.dropOverlayHint")}</div>
      </div>
    </div>
  );
}

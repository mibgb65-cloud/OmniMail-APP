import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { t } from "./i18n";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/fade-scroll.css";
import "./styles/buttons.css";
import "./styles/controls.css";
import "./styles/custom-controls.css";
import "./styles/tooltip.css";
import "./styles/datetime-picker.css";
import "./styles/layout.css";
import "./styles/topbar.css";
import "./styles/topbar-update.css";
import "./styles/topbar-update-popover.css";
import "./styles/sync-status-popover.css";
import "./styles/sync-status-popover-cards.css";
import "./styles/sync-status-popover-healthy.css";
import "./styles/sidebar.css";
import "./styles/sidebar-accounts.css";
import "./styles/sidebar-account-row.css";
import "./styles/account-rename-popover.css";
import "./styles/mail-list.css";
import "./styles/mail-list-return-top.css";
import "./styles/mail-list-footer-tokens.css";
import "./styles/mail-list-footer.css";
import "./styles/mail-list-skeleton.css";
import "./styles/reader-skeleton.css";
import "./styles/mail-card.css";
import "./styles/mail-reader.css";
import "./styles/mail-security-banner.css";
import "./styles/mail-translation.css";
import "./styles/mail-reader-extras.css";
import "./styles/reader-html-theme.css";
import "./styles/zero-account-guide.css";
import "./styles/ai-pane.css";
import "./styles/ai-draft.css";
import "./styles/ai-markdown.css";
import "./styles/ai-panel-slide.css";
import "./styles/modals.css";
import "./styles/provider-connect-modal.css";
import "./styles/provider-connect-form.css";
import "./styles/provider-connect-extras.css";
import "./styles/account-naming.css";
import "./styles/add-account-modal.css";
import "./styles/add-account-directory.css";
import "./styles/add-account-cards.css";
import "./styles/muse-mail.css";
import "./styles/muse-mail-reader.css";
import "./styles/muse-mail-states.css";
import "./styles/workbuddy-mail.css";
import "./styles/workbuddy-mail-list.css";
import "./styles/workbuddy-mail-reader.css";
import "./styles/external-link-tokens.css";
import "./styles/external-link-modal.css";
import "./styles/image-lightbox.css";
import "./styles/image-lightbox-controls.css";
import "./styles/handshake.css";
import "./styles/compose.css";
import "./styles/compose-rich-editor.css";
import "./styles/compose-drop-zone.css";
import "./styles/settings.css";
import "./styles/about-updater.css";
import "./styles/ai-provider-settings.css";
import "./styles/translation-settings.css";
import "./styles/pages.css";
import "./styles/contact-directory-toolbar.css";
import "./styles/contact-duplicate-review.css";
import "./styles/drawers.css";
import "./styles/keyframes.css";
import "./styles/motion.css";
import "./styles/motion-theme.css";
import "./styles/splash.css";
import "./styles/splash-motion.css";
import "./styles/i18n-layout.css";
import "./styles/responsive-laptop.css";
import "./styles/responsive.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error(t("common.missingRoot"));
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

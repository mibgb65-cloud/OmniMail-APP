import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/fade-scroll.css";
import "./styles/buttons.css";
import "./styles/controls.css";
import "./styles/custom-controls.css";
import "./styles/datetime-picker.css";
import "./styles/layout.css";
import "./styles/topbar.css";
import "./styles/sidebar.css";
import "./styles/sidebar-accounts.css";
import "./styles/sidebar-account-row.css";
import "./styles/mail-list.css";
import "./styles/mail-card.css";
import "./styles/mail-reader.css";
import "./styles/mail-translation.css";
import "./styles/mail-reader-extras.css";
import "./styles/zero-account-guide.css";
import "./styles/ai-pane.css";
import "./styles/ai-markdown.css";
import "./styles/ai-panel-slide.css";
import "./styles/modals.css";
import "./styles/handshake.css";
import "./styles/compose.css";
import "./styles/settings.css";
import "./styles/ai-provider-settings.css";
import "./styles/pages.css";
import "./styles/contact-directory-toolbar.css";
import "./styles/contact-duplicate-review.css";
import "./styles/drawers.css";
import "./styles/keyframes.css";
import "./styles/motion.css";
import "./styles/motion-theme.css";
import "./styles/splash.css";
import "./styles/splash-motion.css";
import "./styles/responsive-laptop.css";
import "./styles/responsive.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("缺少 OmniMail 界面挂载点。");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

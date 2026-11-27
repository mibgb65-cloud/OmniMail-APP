import type { LEGAL_DOCS } from "../data/legalDocsZh.ts";

export const LEGAL_DOCS_EN: typeof LEGAL_DOCS = {
  terms: {
    title: "Terms of Service",
    badge: "Official · V1.0",
    updatedAt: "Effective: Nov 27, 2026",
    sections: [
      {
        heading: "1. Open-Source Nature & License",
        body: "OmniMail is a local-first desktop multi-account email workspace distributed under the MIT License. It operates without any centralized cloud account system or subscription fees, with full source code open for community inspection and security auditing.",
      },
      {
        heading: "2. Mailbox Connection & Authorization",
        body: "OmniMail connects directly to email providers as a standard client via official browser PKCE OAuth 2.0, dedicated app-specific passwords, isolated web sessions, or standard IMAP/SMTP protocols. Web login passwords are never requested or stored. Users remain subject to each mail provider's terms and sending quotas.",
      },
      {
        heading: "3. Sender Identity & Lawful Use",
        body: "OmniMail provides original-account reply locking, undo-send buffering, and external link confirmation to prevent accidental actions, while all mail transmissions are initiated solely by the user. Users must not use the software for spam, phishing, malware distribution, or unlawful activities.",
      },
      {
        heading: "4. AI Assistant & Translation Boundaries",
        body: "OmniMail includes built-in mail translation and optional Bring-Your-Own-Key (BYOK) multi-model AI tools. Generated summaries, action items, and reply drafts are provided strictly as assistive references; users must review and explicitly send any reply, and OmniMail never dispatches emails autonomously.",
      },
      {
        heading: "5. Local Data Custody & High-Impact Actions",
        body: "Raw messages, full-text indexes, contacts, and inbox rules reside in your chosen local directory. Permanent message deletion, emptying Trash, removing accounts, and wiping workspace data require explicit confirmation. Please maintain device storage health and export periodic local backups.",
      },
      {
        heading: "6. Warranty Disclaimer & Official Updates",
        body: 'Pursuant to the MIT License, the software is provided "AS IS" without implied warranties of merchantability or third-party mail server uptime. Official installers are distributed via GitHub Releases with an OmniMail digital signature and mandatory SHA-256 verification.',
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    badge: "Official · V1.0",
    updatedAt: "Effective: Nov 27, 2026",
    sections: [
      {
        heading: "1. Zero Cloud Upload & Isolated Workspaces",
        body: "OmniMail upholds full local data sovereignty with zero relay servers, zero telemetry, zero behavioral analytics, and zero ad tracking. Each local workspace maintains physically isolated SQLite databases and Zstd archives, protected optionally by an Argon2id-derived PIN lock.",
      },
      {
        heading: "2. Hardware-Backed Vault & Ephemeral Sessions",
        body: "OAuth refresh tokens, app passwords, and AI API keys are encrypted via user-scoped Windows DPAPI into your local secrets.vault and never written in plaintext. Read-only agent mailboxes such as Meta Muse (@muse.ai) run in ephemeral memory and temporary WebView2 directories wiped upon lock, switch, or exit.",
      },
      {
        heading: "3. Sanitized Rendering & Anti-Tracking",
        body: "Email HTML/CSS is sanitized via strict allowlists inside an isolated Shadow DOM sandbox. Remote tracking pixels and external CSS background images are blocked by default alongside local SPF/DKIM/DMARC anti-phishing checks, loading external media only upon explicit user consent.",
      },
      {
        heading: "4. Translation & 5-Step PrivacyGuard AI",
        body: "Launching OmniMail never transmits mail content in the background. Only when you trigger translation, invoke Omni AI, or explicitly enable auto-summary does the 5-step PrivacyGuard run: blocking verification/financial mails, redacting PII patterns, and sending only visible plain text without headers or attachments.",
      },
      {
        heading: "5. Transparent Outbound Network Scope",
        body: "Beyond connecting directly to your configured mail servers, outbound requests occur solely when invoking built-in translation, calling your configured BYOK AI endpoint, or querying official GitHub Releases metadata and SHA256SUMS.txt during update checks.",
      },
      {
        heading: "6. Data Portability, Redaction & Full Wipe",
        body: "You retain complete control to migrate your data directory, export workspace ZIP snapshots or .mbox archives, or irreversibly wipe all local caches, indexes, and encrypted credentials. Exported diagnostic bundles automatically strip passwords, tokens, API keys, message bodies, and email addresses.",
      },
    ],
  },
};

import type { updater as zhUpdater } from "../zh/updater.ts";

export const updater = {
  chipNewVersion: "New {version}",
  chipUpdateBadge: "Update",
  chipLaptopHasUpdate: "Update",
  chipDownloadingWide: "Downloading {percent}%{speedPart}",
  chipDownloadingSpeedPart: " · {speed}",
  chipVerifyingWide: "Verifying SHA-256…",
  chipReadyWide: "Verified · Click to restart",
  chipReadyLaptop: "Restart to update",
  chipInstallingWide: "Updating & restarting…",
  chipInstallingLaptop: "Updating…",
  chipErrorWide: "Update error · Retry",
  chipErrorLaptop: "Retry",
  chipTooltipAvailable: "New version {version} available · Click to update",
  chipTooltipDownloading:
    "Downloading {version} ({percent}%) · Click for details",
  chipTooltipVerifying: "Verifying SHA-256 package integrity…",
  chipTooltipReady:
    "{version} passed SHA-256 check · Click to silently restart",
  chipTooltipError: "Update failed: {error}",

  popHeading: "Update Available",
  popCurrentLabel: "Current",
  popSizeLabel: "Package Size",
  popVerifyLabel: "Integrity",
  popVerifyValue: "SHA-256 Verified",
  popHighlightsTitle: "What's New",
  popHighlightsFallback:
    "Includes experience improvements, protocol reliability, and security fixes",
  popSilentHint:
    "Downloads and verifies in the background, then upgrades silently and restarts automatically without wizard prompts",
  popComposeHoldHint:
    "Open compose draft detected — OmniMail will wait for your confirmation before restarting",
  popSkipBtn: "Skip version",
  popFullNotesBtn: "Full notes",
  popSilentUpdateBtn: "One-Click Silent Update",
  popCancelDownloadBtn: "Cancel download",
  popSilentRestartBtn: "Silent Restart Now",
  popRetryDownloadBtn: "Retry Download",
  popOpenFolderBtn: "Open folder",
  popDownloadingStage: "Downloading installer in background… {percent}%",
  popVerifyingStage: "Matching SHA256SUMS.txt digest…",
  popReadyStage: "SHA-256 verified — ready to silently upgrade and restart",
  popInstallingStage: "Launching silent installer and closing cleanly…",

  toastReadyAutoRestartTitle:
    "{version} verified — restarting silently in 3s to finish update",
  toastReadyAutoRestartAction: "Later",
  toastReadyDraftSafeTitle: "{version} downloaded and SHA-256 verified",
  toastReadyDraftSafeDetail:
    "Compose draft is open — click “Verified · Click to restart” in the top bar whenever ready",
  toastSkippedTitle: "Muted automatic reminders for {version}",
  toastUpToDateTitle: "You're up to date ({version})",
  toastCheckFailedTitle: "Update check failed",

  aboutHeaderSub:
    "Inspect current build, release channel, and automatic update preferences",
  aboutFooterHasUpdate: "New",
  aboutStatusLatest: "Up to date",
  aboutStatusHasUpdate: "Update {version}",
  aboutStatusDownloading: "Downloading {percent}%",
  aboutStatusReady: "Ready to restart",
  aboutCheckNowBtn: "Check for updates",
  aboutCheckingBtn: "Checking…",
  aboutLastCheckedLabel: "Last checked: {time}",
  aboutNeverCheckedLabel: "Not checked yet",
  aboutCardBannerAvailable:
    "New release {version} is available for background verification and silent upgrade",
  aboutCardBannerDownloading:
    "Downloading {version} in background ({percent}%{speedPart})",
  aboutCardBannerVerifying: "Verifying SHA-256 cryptographic digest…",
  aboutCardBannerReady:
    "{version} passed strict SHA-256 check — click to upgrade and restart silently",
  aboutCardBannerError: "Update error: {error}",
  aboutViewChangelogBtn: "Release notes",

  aboutPrefsCardTitle: "Automatic Updates & Release Channel",
  aboutAutoCheckTitle: "Check for updates automatically on launch",
  aboutAutoCheckDesc:
    "Checks quietly 10s after launch and every 12 hours without interrupting your workflow",
  aboutChannelTitle: "Update channel preference",
  aboutChannelDesc:
    "Applies to the next scheduled check or manual Check for updates",
  aboutChannelStable: "Stable only",
  aboutChannelBeta: "Include Beta builds",
  aboutSecurityTitle: "Cryptographic verification & silent upgrade",
  aboutSecurityDesc:
    "Streams over trusted HTTPS, verifies SHA256SUMS.txt, and runs NSIS silent upgrade while preserving workspaces and startup settings",
  aboutSecurityBadge: "SHA-256 Enforced",

  aboutLinksCardTitle: "Legal, Open Source & Diagnostics",
  aboutGithubReleasesBtn: "GitHub Releases",
  aboutTermsCleanBtn: "Terms of Service",
  aboutPrivacyCleanBtn: "Privacy Policy",

  modalFullNotesTitle: "Release Notes",
  modalShaVerifiedLabel: "SHA-256 verified: {hash}",
  modalManualInstallBtn: "Interactive Wizard",
  modalOpenDownloadDirBtn: "Open Download Folder",
  modalErrorRetryBtn: "Retry Check",
} satisfies typeof zhUpdater;

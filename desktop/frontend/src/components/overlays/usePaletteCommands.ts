import { useMemo } from "react";
import { useI18n } from "../../i18n";
import { useApp } from "../../state/AppContext";
import { resolveSidebarAccountTitle } from "../../utils/accountDisplay";
import type { IconName } from "../common/Icon";
import { filterPaletteCommands } from "./paletteCommandFilter";

export type PaletteCategory =
  "all" | "actions" | "accounts" | "folders" | "settings";

export interface PaletteCommand {
  id: string;
  cat: Exclude<PaletteCategory, "all">;
  icon: IconName;
  title: string;
  hint: string;
  shortcut?: string;
  run: () => void;
}

export function usePaletteCommands(
  query: string,
  category: PaletteCategory,
  close: () => void,
): PaletteCommand[] {
  const { workspace, mailStore, composeStore, aiStore, triggerSyncAll } =
    useApp();
  const { lang, t, localizeText } = useI18n();

  return useMemo<PaletteCommand[]>(() => {
    const activeName = workspace.activeProfile?.name
      ? localizeText(workspace.activeProfile.name)
      : t("common.personalWorkspace");
    const isLight = workspace.settings.theme === "light";
    const closeRun = (fn: () => void) => () => {
      fn();
      close();
    };
    const list: PaletteCommand[] = [
      {
        id: "cmd-compose",
        cat: "actions",
        icon: "pen",
        title: t("overlays.cmdComposeTitle"),
        hint: t("overlays.cmdComposeHint"),
        shortcut: "Ctrl N",
        run: closeRun(() => composeStore.openNewCompose()),
      },
      {
        id: "cmd-sync",
        cat: "actions",
        icon: "refresh",
        title: t("overlays.cmdSyncTitle"),
        hint: t("overlays.cmdSyncHint"),
        shortcut: "Ctrl R",
        run: closeRun(triggerSyncAll),
      },
      {
        id: "cmd-profiles",
        cat: "accounts",
        icon: "lock",
        title: t("overlays.cmdProfilesTitle"),
        hint: t("overlays.cmdProfilesHint", { name: activeName }),
        run: () =>
          workspace.setOverlay({ type: "profile-manage", mode: "switch" }),
      },
      {
        id: "cmd-theme",
        cat: "settings",
        icon: isLight ? "moon" : "sun",
        title: isLight
          ? t("overlays.cmdThemeDarkTitle")
          : t("overlays.cmdThemeLightTitle"),
        hint: t("overlays.cmdThemeHint"),
        shortcut: "Ctrl Shift T",
        run: closeRun(workspace.toggleTheme),
      },
      {
        id: "cmd-ai",
        cat: "actions",
        icon: "sparkle",
        title: aiStore.aiOpen
          ? t("overlays.cmdAiHideTitle")
          : t("overlays.cmdAiShowTitle"),
        hint: t("overlays.cmdAiHint"),
        shortcut: "Alt A",
        run: closeRun(() => aiStore.setAiOpen((v) => !v)),
      },
      {
        id: "cmd-adv-search",
        cat: "actions",
        icon: "filter",
        title: t("overlays.cmdAdvSearchTitle"),
        hint: t("overlays.cmdAdvSearchHint"),
        run: () => workspace.setOverlay({ type: "advanced-search" }),
      },
      {
        id: "cmd-contacts",
        cat: "folders",
        icon: "users",
        title: t("overlays.cmdContactsTitle"),
        hint: t("overlays.cmdContactsHint"),
        run: closeRun(() => workspace.setScreen("contacts")),
      },
      {
        id: "cmd-add-acc",
        cat: "accounts",
        icon: "plus",
        title: t("overlays.cmdAddAccTitle"),
        hint: t("overlays.cmdAddAccHint"),
        run: () => workspace.setOverlay({ type: "add-account" }),
      },
      {
        id: "cmd-inbox",
        cat: "folders",
        icon: "inbox",
        title: t("overlays.cmdInboxTitle"),
        hint: t("overlays.cmdInboxHint"),
        shortcut: "G I",
        run: closeRun(() => {
          workspace.setScreen("mail");
          mailStore.selectFolder("inbox");
          mailStore.setAccountFilter(null);
        }),
      },
      {
        id: "cmd-settings-rules",
        cat: "settings",
        icon: "rule",
        title: t("overlays.cmdRulesTitle"),
        hint: t("overlays.cmdRulesHint"),
        run: () => workspace.setOverlay({ type: "settings", tab: "rules" }),
      },
      {
        id: "cmd-settings-storage",
        cat: "settings",
        icon: "database",
        title: t("overlays.cmdStorageTitle"),
        hint: t("overlays.cmdStorageHint"),
        run: () => workspace.setOverlay({ type: "settings", tab: "storage" }),
      },
      ...workspace.accounts.map<PaletteCommand>((acc) => ({
        id: `acc-${acc.id}`,
        cat: "accounts",
        icon: "mail",
        title: t("overlays.cmdAccountOnlyTitle", {
          name: resolveSidebarAccountTitle(acc, lang),
        }),
        hint: acc.email,
        run: closeRun(() => {
          workspace.setScreen("mail");
          mailStore.setAccountFilter(acc.id);
        }),
      })),
    ];
    return filterPaletteCommands(list, query, category, t, (q: string) => {
      workspace.setScreen("mail");
      mailStore.setSearchQuery(q);
      close();
    });
  }, [
    workspace,
    mailStore,
    composeStore,
    aiStore,
    triggerSyncAll,
    query,
    category,
    close,
    lang,
    t,
    localizeText,
  ]);
}

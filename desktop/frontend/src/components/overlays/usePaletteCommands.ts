import { useMemo } from "react";
import { useApp } from "../../state/AppContext";

export type PaletteCategory =
  "all" | "actions" | "accounts" | "folders" | "settings";

export interface PaletteCommand {
  id: string;
  cat: Exclude<PaletteCategory, "all">;
  icon: string;
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

  return useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      {
        id: "cmd-compose",
        cat: "actions",
        icon: "pen",
        title: "写新邮件",
        hint: "使用默认发件账户新建邮件",
        shortcut: "Ctrl N",
        run: () => {
          close();
          composeStore.openNewCompose();
        },
      },
      {
        id: "cmd-sync",
        cat: "actions",
        icon: "refresh",
        title: "立即同步全部邮箱",
        hint: "刷新所有已接入账户与本地索引",
        shortcut: "Ctrl R",
        run: () => {
          close();
          triggerSyncAll();
        },
      },
      {
        id: "cmd-theme",
        cat: "settings",
        icon: workspace.settings.theme === "light" ? "moon" : "sun",
        title:
          workspace.settings.theme === "light"
            ? "切换为深色模式"
            : "切换为亮色模式",
        hint: "立即切换 Obsidian Slate / 浅色工作台",
        shortcut: "Ctrl Shift T",
        run: () => {
          workspace.toggleTheme();
          close();
        },
      },
      {
        id: "cmd-ai",
        cat: "actions",
        icon: "sparkle",
        title: aiStore.aiOpen
          ? "收起右侧 Omni AI 面板"
          : "展开右侧 Omni AI 面板",
        hint: "切换阅读区旁的 AI 浮层卡片",
        shortcut: "Alt A",
        run: () => {
          aiStore.setAiOpen((v) => !v);
          close();
        },
      },
      {
        id: "cmd-adv-search",
        cat: "actions",
        icon: "filter",
        title: "打开高级搜索",
        hint: "按发件人、主题、邮箱范围、附件与时间过滤",
        run: () => workspace.setOverlay({ type: "advanced-search" }),
      },
      {
        id: "cmd-contacts",
        cat: "folders",
        icon: "users",
        title: "打开联系人与通讯录",
        hint: "管理 VIP 发件人、分组与黑名单",
        run: () => {
          workspace.setScreen("contacts");
          close();
        },
      },
      {
        id: "cmd-add-acc",
        cat: "accounts",
        icon: "plus",
        title: "添加新邮箱账户",
        hint: "接入 Gmail、QQ、网易 163/126 或手动 IMAP",
        run: () => workspace.setOverlay({ type: "add-account" }),
      },
      {
        id: "cmd-inbox",
        cat: "folders",
        icon: "inbox",
        title: "切换至统一收件箱",
        hint: "查看全部邮箱收件箱",
        shortcut: "G I",
        run: () => {
          workspace.setScreen("mail");
          mailStore.selectFolder("inbox");
          mailStore.setAccountFilter(null);
          close();
        },
      },
      {
        id: "cmd-snoozed",
        cat: "folders",
        icon: "clock",
        title: "切换至稍后处理",
        hint: "查看已延后提醒的邮件",
        shortcut: "G L",
        run: () => {
          workspace.setScreen("mail");
          mailStore.selectFolder("snoozed");
          close();
        },
      },
      {
        id: "cmd-settings-rules",
        cat: "settings",
        icon: "rule",
        title: "管理收件规则与自动分拣",
        hint: "打开设置 → 收件规则",
        run: () => workspace.setOverlay({ type: "settings", tab: "rules" }),
      },
      {
        id: "cmd-settings-autoreply",
        cat: "settings",
        icon: "autoReply",
        title: "配置外出 / 休假自动回复",
        hint: "打开设置 → 自动回复",
        run: () =>
          workspace.setOverlay({ type: "settings", tab: "auto-reply" }),
      },
      {
        id: "cmd-settings-storage",
        cat: "settings",
        icon: "database",
        title: "存储空间与备份迁移",
        hint: "查看本地缓存占比、清理附件或导出备份",
        run: () => workspace.setOverlay({ type: "settings", tab: "storage" }),
      },
      ...workspace.accounts.map((acc) => ({
        id: `acc-${acc.id}`,
        cat: "accounts" as const,
        icon: "mail",
        title: `仅看：${acc.name}`,
        hint: acc.email,
        run: () => {
          workspace.setScreen("mail");
          mailStore.setAccountFilter(acc.id);
          close();
        },
      })),
    ];
    const q = query.trim().toLowerCase();
    return list.filter(
      (c) =>
        (category === "all" || c.cat === category) &&
        (!q ||
          c.title.toLowerCase().includes(q) ||
          c.hint.toLowerCase().includes(q)),
    );
  }, [
    workspace,
    mailStore,
    composeStore,
    aiStore,
    triggerSyncAll,
    query,
    category,
    close,
  ]);
}

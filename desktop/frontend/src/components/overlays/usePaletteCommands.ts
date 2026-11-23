import { useMemo } from "react";
import { useApp } from "../../state/AppContext";
import type { IconName } from "../common/Icon";

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

  return useMemo<PaletteCommand[]>(() => {
    const q = query.trim();
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
        hint: "触发后台 SyncWorker 增量同步全部账户",
        shortcut: "Ctrl R",
        run: () => {
          close();
          triggerSyncAll();
        },
      },
      {
        id: "cmd-profiles",
        cat: "accounts",
        icon: "lock",
        title: "切换或管理本地工作空间",
        hint: `当前活跃：${workspace.activeProfile?.name || "个人工作空间"}`,
        run: () =>
          workspace.setOverlay({ type: "profile-manage", mode: "switch" }),
      },
      {
        id: "cmd-theme",
        cat: "settings",
        icon: workspace.settings.theme === "light" ? "moon" : "sun",
        title:
          workspace.settings.theme === "light"
            ? "切换为深色模式"
            : "切换为亮色模式",
        hint: "立即切换深浅色工作台",
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
        title: "打开高级全文搜索",
        hint: "走本地 SQLite FTS5 trigram 引擎组合过滤",
        run: () => workspace.setOverlay({ type: "advanced-search" }),
      },
      {
        id: "cmd-contacts",
        cat: "folders",
        icon: "users",
        title: "打开联系人与通讯录",
        hint: "管理 VIP 发件人、重复合并、vCard 与黑名单",
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
        hint: "接入 Gmail、QQ、网易 163/126、Naver 或手动 IMAP",
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
        id: "cmd-settings-rules",
        cat: "settings",
        icon: "rule",
        title: "管理收件规则与自动分拣",
        hint: "打开设置 → 收件规则",
        run: () => workspace.setOverlay({ type: "settings", tab: "rules" }),
      },
      {
        id: "cmd-settings-storage",
        cat: "settings",
        icon: "database",
        title: "存储空间与备份迁移",
        hint: "查看磁盘占用明细、清理附件缓存或导出备份",
        run: () => workspace.setOverlay({ type: "settings", tab: "storage" }),
      },
      ...workspace.accounts.map<PaletteCommand>((acc) => ({
        id: `acc-${acc.id}`,
        cat: "accounts",
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

    const lower = q.toLowerCase();
    const matched = list.filter(
      (c) =>
        (category === "all" || c.cat === category) &&
        (!lower ||
          c.title.toLowerCase().includes(lower) ||
          c.hint.toLowerCase().includes(lower)),
    );
    if (q) {
      matched.unshift({
        id: `fts-${q}`,
        cat: "actions",
        icon: "search",
        title: `在全部邮件中全文检索：“${q}”`,
        hint: "调用 SQLite FTS5 trigram 毫秒级本地搜索",
        run: () => {
          workspace.setScreen("mail");
          mailStore.setSearchQuery(q);
          close();
        },
      });
    }
    return matched;
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

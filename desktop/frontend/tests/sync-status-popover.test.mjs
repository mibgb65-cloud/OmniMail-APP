import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyAccountStatusToList,
  deriveAccountSyncState,
  formatAccountSyncReason,
  reconcileRuntimeSyncState,
  resolveAccountActionOverlay,
} from "../src/state/accountSyncState.ts";
import { buildSyncChipModel } from "../src/state/syncChipModel.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function makeBaseAccounts() {
  return [
    {
      id: "acc-netease",
      name: "网易邮箱 · work",
      shortTag: "网易邮箱",
      email: "work@163.com",
      provider: "netease",
      providerLabel: "网易邮箱",
      authMode: "authcode",
      status: "connected",
      lastError: "",
      unreadCount: 4,
      lastSyncedAt: "13:07",
      senderName: "Work",
      replyTo: "work@163.com",
      signature: "",
      imap: { host: "imap.163.com", port: 993, security: "SSL/TLS" },
      smtp: { host: "smtp.163.com", port: 465, security: "SSL/TLS" },
      imapIdle: true,
      offlineWindowDays: 90,
      indexedEmails: 120,
      storageMb: 12,
      attachmentCacheMb: 3,
      isDefault: true,
    },
    {
      id: "acc-yandex",
      name: "Yandex Mail · wilsonlivia",
      shortTag: "Yandex",
      email: "wilsonlivia@yandex.com",
      provider: "yandex",
      providerLabel: "Yandex Mail",
      authMode: "app-password",
      status: "error",
      lastError: "连接收件服务器失败（IMAP 993）：unexpected EOF",
      unreadCount: 1,
      lastSyncedAt: "13:01",
      senderName: "Olivia",
      replyTo: "wilsonlivia@yandex.com",
      signature: "",
      imap: { host: "imap.yandex.com", port: 993, security: "SSL/TLS" },
      smtp: { host: "smtp.yandex.com", port: 465, security: "SSL/TLS" },
      imapIdle: true,
      offlineWindowDays: 90,
      indexedEmails: 48,
      storageMb: 6,
      attachmentCacheMb: 1,
      isDefault: false,
    },
  ];
}

test("仅有 Yandex 报错时：TopBar 胶囊与异常列表仅包含 Yandex，绝不把排第一的网易邮箱拉来背锅", () => {
  const accounts = makeBaseAccounts();
  const derived = deriveAccountSyncState(accounts);

  assert.equal(derived.errorAccounts.length, 1);
  assert.equal(derived.errorAccounts[0].id, "acc-yandex");
  assert.equal(derived.issueAccounts.length, 1);
  assert.equal(derived.issueAccounts[0].email, "wilsonlivia@yandex.com");
  assert.equal(derived.healthyAccounts.length, 1);
  assert.equal(derived.healthyAccounts[0].id, "acc-netease");

  const chipZh = buildSyncChipModel({
    accounts,
    bannerMode: "none",
    syncLabel: "同步部分受阻",
    viewport: "wide",
    showJustDone: false,
    lang: "zh-CN",
  });
  assert.equal(chipZh.tone, "warning");
  assert.equal(chipZh.text, "1 个邮箱同步受阻");
  assert.equal(chipZh.showChevron, true);
  assert.equal(chipZh.opensPopover, true);

  const chipEn = buildSyncChipModel({
    accounts,
    bannerMode: "none",
    syncLabel: "Sync partially blocked",
    viewport: "wide",
    showJustDone: false,
    lang: "en-US",
  });
  assert.equal(chipEn.text, "1 account sync issue(s)");

  // 点击「运行连接诊断」严格传入 Yandex 的真实 accountId
  const diagOverlay = resolveAccountActionOverlay(
    derived.issueAccounts[0],
    "diagnostics",
  );
  assert.deepEqual(diagOverlay, {
    type: "diagnostics",
    accountId: "acc-yandex",
  });

  assert.match(
    formatAccountSyncReason(derived.issueAccounts[0], "zh-CN"),
    /unexpected EOF/,
  );
});

test("Yandex 随后收到 connected 事件时：异常计数归零、lastError 清空、TopBar 胶囊自动恢复绿色", () => {
  const initial = makeBaseAccounts();
  const afterRecover = applyAccountStatusToList(
    initial,
    { accountId: "acc-yandex", status: "connected" },
    "zh-CN",
  );

  const derived = deriveAccountSyncState(afterRecover);
  assert.equal(derived.issueAccounts.length, 0);
  assert.equal(derived.allHealthy, true);
  assert.equal(afterRecover[1].lastError, "");

  const reconciled = reconcileRuntimeSyncState({
    accounts: afterRecover,
    bannerMode: "partial-sync",
    syncLabel: "同步部分受阻",
    lang: "zh-CN",
  });
  assert.equal(reconciled.nextBannerMode, "none");
  assert.equal(reconciled.nextSyncLabel, "所有邮箱已同步");

  const chipAfter = buildSyncChipModel({
    accounts: afterRecover,
    bannerMode: reconciled.nextBannerMode,
    syncLabel: reconciled.nextSyncLabel,
    viewport: "wide",
    showJustDone: false,
    lang: "zh-CN",
  });
  assert.equal(chipAfter.tone, "healthy");
  assert.equal(chipAfter.text, "所有邮箱已同步");
  assert.equal(chipAfter.showChevron, false);
  assert.equal(chipAfter.opensPopover, false);
});

test("StatusBanner 不再为 partial-sync 渲染顶部通栏 .runtime-banner 且全链路清除 accounts[0] 兜底", () => {
  const bannerSrc = readFileSync(
    path.join(rootDir, "src", "components", "shell", "StatusBanner.tsx"),
    "utf8",
  );
  const diagSrc = readFileSync(
    path.join(rootDir, "src", "components", "overlays", "DiagnosticsModal.tsx"),
    "utf8",
  );
  const serverSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "overlays",
      "AccountServerModal.tsx",
    ),
    "utf8",
  );

  assert.doesNotMatch(bannerSrc, /accounts\[0\]/);
  assert.doesNotMatch(bannerSrc, /bannerMode\s*===\s*"partial-sync"/);
  assert.doesNotMatch(bannerSrc, /bannerMode\s*===\s*"auth-expired"/);
  assert.doesNotMatch(diagSrc, /accounts\[0\]/);
  assert.doesNotMatch(serverSrc, /accounts\[0\]/);
});

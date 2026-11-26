import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAccountStatusToList,
  applySyncProgressToAccounts,
  canTriggerManualSync,
  reconcileRuntimeSyncState,
} from "../src/state/accountSyncState.ts";
import { buildSyncChipModel } from "../src/state/syncChipModel.ts";

function makeAccount(id, email, provider) {
  return {
    id,
    name: `${provider} · ${id}`,
    shortTag: provider,
    email,
    provider,
    providerLabel: provider,
    authMode: "authcode",
    status: "connected",
    lastError: "",
    unreadCount: 1,
    lastSyncedAt: "10:00",
    senderName: id,
    replyTo: email,
    signature: "",
    imap: { host: "imap.example.com", port: 993, security: "SSL/TLS" },
    smtp: { host: "smtp.example.com", port: 465, security: "SSL/TLS" },
    imapIdle: true,
    offlineWindowDays: 90,
    indexedEmails: 40,
    storageMb: 4,
    attachmentCacheMb: 1,
    isDefault: id === "acc-1",
  };
}

function makeTwoAccounts() {
  return [
    makeAccount("acc-1", "main@qq.com", "qq"),
    makeAccount("acc-2", "dev@gmail.com", "gmail"),
  ];
}

test("后台同步闭环：syncing -> connected 后，即使残留『正在同步…』也能收敛为 healthy 并解除手动刷新锁", () => {
  const syncingList = applyAccountStatusToList(
    makeTwoAccounts(),
    { accountId: "acc-1", status: "syncing" },
    "zh-CN",
  );
  const duringSync = reconcileRuntimeSyncState({
    accounts: syncingList,
    bannerMode: "none",
    syncLabel: "正在同步…",
    lang: "zh-CN",
  });
  assert.equal(duringSync.nextSyncLabel, "正在同步…");
  assert.equal(canTriggerManualSync(syncingList, false), false);

  const chipSyncing = buildSyncChipModel({
    accounts: syncingList,
    bannerMode: "none",
    syncLabel: duringSync.nextSyncLabel,
    viewport: "wide",
    showJustDone: false,
    lang: "zh-CN",
  });
  assert.equal(chipSyncing.tone, "syncing");
  assert.equal(chipSyncing.text, "正在同步…");

  const doneList = applyAccountStatusToList(
    syncingList,
    { accountId: "acc-1", status: "connected" },
    "zh-CN",
  );
  const afterDone = reconcileRuntimeSyncState({
    accounts: doneList,
    bannerMode: "none",
    syncLabel: "正在同步…",
    lang: "zh-CN",
  });
  assert.equal(afterDone.nextSyncLabel, "所有邮箱已同步");
  assert.equal(canTriggerManualSync(doneList, false), true);

  const chipJustDone = buildSyncChipModel({
    accounts: doneList,
    bannerMode: "none",
    syncLabel: "正在同步…",
    viewport: "wide",
    showJustDone: true,
    lang: "zh-CN",
  });
  assert.equal(chipJustDone.tone, "done");
  assert.equal(chipJustDone.text, "全部已同步");

  const chipHealthy = buildSyncChipModel({
    accounts: doneList,
    bannerMode: "none",
    syncLabel: afterDone.nextSyncLabel,
    viewport: "wide",
    showJustDone: false,
    lang: "zh-CN",
  });
  assert.equal(chipHealthy.tone, "healthy");
  assert.equal(chipHealthy.text, "所有邮箱已同步");
});

test("部分失败收敛：1 个账户转为 error、其余 connected 时，不再停在『正在同步…』而收敛为 warning 胶囊", () => {
  const syncingList = applyAccountStatusToList(
    makeTwoAccounts(),
    { accountId: "acc-2", status: "syncing" },
    "zh-CN",
  );
  const errorList = applyAccountStatusToList(
    syncingList,
    { accountId: "acc-2", status: "error", lastError: "IMAP timeout" },
    "zh-CN",
  );
  const reconciled = reconcileRuntimeSyncState({
    accounts: errorList,
    bannerMode: "none",
    syncLabel: "正在同步…",
    lang: "zh-CN",
  });
  assert.equal(reconciled.nextSyncLabel, "同步部分受阻");
  assert.equal(canTriggerManualSync(errorList, false), true);

  const chip = buildSyncChipModel({
    accounts: errorList,
    bannerMode: reconciled.nextBannerMode,
    syncLabel: reconciled.nextSyncLabel,
    viewport: "wide",
    showJustDone: false,
    lang: "zh-CN",
  });
  assert.equal(chip.tone, "warning");
  assert.equal(chip.text, "1 个邮箱同步受阻");
  assert.equal(chip.opensPopover, true);
});

test("手动同步进行中保护与 sync:progress 终态兜底推进：manualSyncPending 期间不闪烁，释放后立即收敛", () => {
  const base = makeTwoAccounts();
  const pending = reconcileRuntimeSyncState({
    accounts: base,
    bannerMode: "none",
    syncLabel: "正在同步 2 个邮箱…",
    lang: "zh-CN",
    manualSyncPending: true,
  });
  assert.equal(pending.nextSyncLabel, "正在同步 2 个邮箱…");
  assert.equal(canTriggerManualSync(base, true), false);

  const chipPending = buildSyncChipModel({
    accounts: base,
    bannerMode: "none",
    syncLabel: pending.nextSyncLabel,
    viewport: "wide",
    showJustDone: false,
    lang: "zh-CN",
    manualSyncPending: true,
  });
  assert.equal(chipPending.tone, "syncing");
  assert.equal(chipPending.text, "正在同步 2 个邮箱…");

  const optimistic = applyAccountStatusToList(
    base,
    { accountId: "acc-1", status: "syncing" },
    "zh-CN",
  );
  const settledByProgress = applySyncProgressToAccounts(
    optimistic,
    { accountId: "acc-1", status: "done" },
    "zh-CN",
  );
  assert.equal(settledByProgress[0].status, "connected");

  const released = reconcileRuntimeSyncState({
    accounts: settledByProgress,
    bannerMode: "none",
    syncLabel: "正在同步 2 个邮箱…",
    lang: "zh-CN",
    manualSyncPending: false,
  });
  assert.equal(released.nextSyncLabel, "所有邮箱已同步");
});

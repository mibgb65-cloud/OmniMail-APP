import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildTailMailCursor,
  canBackfillRemoteFolder,
  mergeOlderMailItems,
  resolveMailListFooterKind,
} from "../src/state/mailListBackfillPolicy.ts";

const EMPTY_ADV = {
  from: "",
  to: "",
  subject: "",
  accountId: "all",
  hasAttachment: false,
  dateRange: "all",
};

test("远端回溯资格校验：常规远端文件夹自动/手动放行，搜索与本地文件夹拦截", () => {
  const base = {
    activeFolder: "inbox",
    activeLabelId: null,
    filterTab: "all",
    searchQuery: "",
    advSearch: EMPTY_ADV,
  };
  assert.equal(canBackfillRemoteFolder(base, false), true);
  assert.equal(
    canBackfillRemoteFolder({ ...base, activeFolder: "sent" }, false),
    true,
  );
  assert.equal(
    canBackfillRemoteFolder({ ...base, activeFolder: "starred" }, true),
    false,
  );
  assert.equal(
    canBackfillRemoteFolder({ ...base, activeFolder: "outbox" }, true),
    false,
  );
  assert.equal(
    canBackfillRemoteFolder({ ...base, activeFolder: "scheduled" }, true),
    false,
  );
  assert.equal(
    canBackfillRemoteFolder({ ...base, activeFolder: "snoozed" }, true),
    false,
  );
  assert.equal(
    canBackfillRemoteFolder({ ...base, searchQuery: "invoice" }, true),
    false,
  );
  assert.equal(
    canBackfillRemoteFolder({ ...base, activeLabelId: "lbl-1" }, true),
    false,
  );
  assert.equal(
    canBackfillRemoteFolder(
      { ...base, advSearch: { ...EMPTY_ADV, hasAttachment: true } },
      true,
    ),
    false,
  );
  // 未读筛选页签下不自动回溯，但允许用户点击手动兜底按钮
  assert.equal(
    canBackfillRemoteFolder({ ...base, filterTab: "unread" }, false),
    false,
  );
  assert.equal(
    canBackfillRemoteFolder({ ...base, filterTab: "unread" }, true),
    true,
  );
});

test("尾部游标构造与去重追加不破坏原顺序", () => {
  assert.equal(buildTailMailCursor([]), "");
  assert.equal(
    buildTailMailCursor([
      { id: "m1", receivedAtUnixMs: 2000 },
      { id: "m2", receivedAtUnixMs: 1000 },
    ]),
    "1000:m2",
  );

  const merged = mergeOlderMailItems(
    [{ id: "m1" }, { id: "m2" }],
    [{ id: "m2" }, { id: "m3" }, { id: "m4" }],
  );
  assert.deepEqual(
    merged.map((m) => m.id),
    ["m1", "m2", "m3", "m4"],
  );
});

test("底部 5 态状态机解析与防遮挡 / 减动效样式契约", () => {
  const base = {
    loadingMore: false,
    loadingRemoteOlder: false,
    loadMoreError: "",
    hasMore: false,
    hasRemoteMore: false,
    loadedCount: 50,
    canManualBackfill: true,
  };
  assert.equal(
    resolveMailListFooterKind({ ...base, loadingMore: true }),
    "local-loading",
  );
  assert.equal(
    resolveMailListFooterKind({ ...base, loadingRemoteOlder: true }),
    "remote-loading",
  );
  assert.equal(
    resolveMailListFooterKind({ ...base, loadMoreError: "连接超时" }),
    "error",
  );
  assert.equal(
    resolveMailListFooterKind({ ...base, hasRemoteMore: true }),
    "manual-more",
  );
  assert.equal(resolveMailListFooterKind(base), "end");
  assert.equal(resolveMailListFooterKind({ ...base, hasMore: true }), "none");

  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const footerCss = readFileSync(
    path.join(rootDir, "src", "styles", "mail-list-footer.css"),
    "utf8",
  );
  assert.match(footerCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(footerCss, /\.mail-card-skeleton/);
});

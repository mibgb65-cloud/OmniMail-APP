import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  formatListScopeKey,
  getListReloadDelayMs,
  resolveMailListViewPhase,
  resolveReaderViewPhase,
  SEARCH_RELOAD_DEBOUNCE_MS,
} from "../src/state/mailListLoadingPolicy.ts";

const EMPTY_ADV = {
  from: "",
  to: "",
  subject: "",
  accountId: "all",
  hasAttachment: false,
  dateRange: "all",
};

test("切账号/文件夹零延迟发起请求，仅搜索输入保留防抖", () => {
  assert.equal(getListReloadDelayMs("", ""), 0);
  assert.equal(getListReloadDelayMs("invoice", "invoice"), 0);
  assert.equal(getListReloadDelayMs("", "i"), SEARCH_RELOAD_DEBOUNCE_MS);
  assert.equal(getListReloadDelayMs("inv", "invo"), SEARCH_RELOAD_DEBOUNCE_MS);
});

test("列表渲染严格遵循 无账号 → 骨架屏 → 错误重试 → 真实空态 → 正常列表 优先级", () => {
  assert.equal(
    resolveMailListViewPhase({
      accountCount: 0,
      isInitialLoading: true,
      listError: "err",
      itemCount: 0,
    }),
    "no-accounts",
  );
  // 加载中绝不误闪空态
  assert.equal(
    resolveMailListViewPhase({
      accountCount: 2,
      isInitialLoading: true,
      listError: "",
      itemCount: 0,
    }),
    "loading",
  );
  // 请求失败后结束首次加载，展示错误重试态而不卡死骨架屏
  assert.equal(
    resolveMailListViewPhase({
      accountCount: 2,
      isInitialLoading: false,
      listError: "数据库查询超时",
      itemCount: 0,
    }),
    "error",
  );
  // 真正 0 封邮件时显示空态
  assert.equal(
    resolveMailListViewPhase({
      accountCount: 2,
      isInitialLoading: false,
      listError: "",
      itemCount: 0,
    }),
    "empty",
  );
  assert.equal(
    resolveMailListViewPhase({
      accountCount: 2,
      isInitialLoading: false,
      listError: "",
      itemCount: 12,
    }),
    "ready",
  );
});

test("阅读区在列表首次加载未返回时展示正文骨架，不闪现未选择邮件空态", () => {
  assert.equal(
    resolveReaderViewPhase({
      accountCount: 1,
      isInitialLoading: true,
      hasSelectedMail: false,
    }),
    "loading",
  );
  assert.equal(
    resolveReaderViewPhase({
      accountCount: 1,
      isInitialLoading: false,
      hasSelectedMail: false,
    }),
    "empty",
  );
  assert.equal(
    resolveReaderViewPhase({
      accountCount: 0,
      isInitialLoading: true,
      hasSelectedMail: false,
    }),
    "no-accounts",
  );
  assert.equal(
    resolveReaderViewPhase({
      accountCount: 1,
      isInitialLoading: true,
      hasSelectedMail: true,
    }),
    "ready",
  );
});

test("作用域键随邮箱/文件夹/筛选变动而变化，且骨架屏与刷新条样式符合规范", () => {
  const baseCtx = {
    activeFolder: "inbox",
    activeLabelId: null,
    filterTab: "all",
    searchQuery: "",
    advSearch: EMPTY_ADV,
  };
  const k1 = formatListScopeKey("acc-1", baseCtx);
  const k2 = formatListScopeKey("acc-2", baseCtx);
  const k3 = formatListScopeKey("acc-1", { ...baseCtx, activeFolder: "sent" });
  const k4 = formatListScopeKey("acc-1", { ...baseCtx, filterTab: "unread" });
  assert.equal(new Set([k1, k2, k3, k4]).size, 4);

  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const skelCss = readFileSync(
    path.join(rootDir, "src", "styles", "mail-list-skeleton.css"),
    "utf8",
  );
  assert.match(skelCss, /#eef2f7/i);
  assert.match(skelCss, /#f8fafc/i);
  assert.match(skelCss, /#1c2433/i);
  assert.match(skelCss, /#263146/i);
  assert.match(skelCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(skelCss, /\.list-refresh-bar/);
  assert.match(skelCss, /\.is-spinning/);
});

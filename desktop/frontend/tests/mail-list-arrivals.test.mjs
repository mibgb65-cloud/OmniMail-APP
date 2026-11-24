import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  addedMailIds,
  consumeArrivalsAtTop,
  mailListScrollFlags,
  mailReaderScrollFlags,
  scrollViewportToTop,
  selectArrivalIds,
} from "../src/state/mailListArrivalPolicy.ts";

test("列表头部和胶囊分别遵循零与 240px 的严格阈值", () => {
  assert.deepEqual(mailListScrollFlags(0), {
    scrolled: false,
    showPill: false,
  });
  assert.deepEqual(mailListScrollFlags(1), { scrolled: true, showPill: false });
  assert.deepEqual(mailListScrollFlags(240), {
    scrolled: true,
    showPill: false,
  });
  assert.deepEqual(mailListScrollFlags(240.1), {
    scrolled: true,
    showPill: true,
  });
});

test("同一封邮件的文件夹和账户同步通知不会重复计数", () => {
  const requested = new Set();
  const existing = new Set(["visible"]);
  assert.deepEqual(
    selectArrivalIds(["one", "visible", "one"], existing, requested),
    ["one"],
  );
  assert.deepEqual(
    selectArrivalIds(["one", "two", "visible"], existing, requested),
    ["two"],
  );
  assert.deepEqual(
    addedMailIds({ addedIds: ["ok", null, 1, "", " space", "x".repeat(129)] }),
    ["ok"],
  );
  assert.deepEqual(addedMailIds({ addedIds: "not-an-array" }), []);
});

test("中途减速隐藏胶囊并不清零，回到顶部才清零并触发待处理的刷新", () => {
  const matching = new Set(["one", "two"]);
  assert.equal(consumeArrivalsAtTop(15, matching, true), false);
  assert.equal(matching.size, 2);
  assert.equal(consumeArrivalsAtTop(0, matching, false), true);
  assert.equal(matching.size, 0);
  assert.equal(consumeArrivalsAtTop(0, matching, false), false);
  assert.equal(consumeArrivalsAtTop(0, matching, true), true);
});

test("正文阅读区工具栏阴影与回顶胶囊遵循零与 320px 阈值，且复用统一胶囊与打印隐藏规则", () => {
  assert.deepEqual(mailReaderScrollFlags(0), {
    scrolled: false,
    showReturnTop: false,
  });
  assert.deepEqual(mailReaderScrollFlags(1), {
    scrolled: true,
    showReturnTop: false,
  });
  assert.deepEqual(mailReaderScrollFlags(320), {
    scrolled: true,
    showReturnTop: false,
  });
  assert.deepEqual(mailReaderScrollFlags(320.1), {
    scrolled: true,
    showReturnTop: true,
  });

  const calls = [];
  const prevMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false });
  try {
    scrollViewportToTop({
      focus: (opts) => calls.push(["focus", opts]),
      scrollTo: (opts) => calls.push(["scrollTo", opts]),
    });
    globalThis.matchMedia = () => ({ matches: true });
    scrollViewportToTop({
      focus: (opts) => calls.push(["focus", opts]),
      scrollTo: (opts) => calls.push(["scrollTo", opts]),
    });
  } finally {
    globalThis.matchMedia = prevMatchMedia;
  }
  assert.deepEqual(calls, [
    ["focus", { preventScroll: true }],
    ["scrollTo", { top: 0, behavior: "smooth" }],
    ["focus", { preventScroll: true }],
    ["scrollTo", { top: 0, behavior: "auto" }],
  ]);

  const srcDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src",
  );
  const pillSource = readFileSync(
    path.join(srcDir, "components/common/ScrollToTopPill.tsx"),
    "utf8",
  );
  const readerSource = readFileSync(
    path.join(srcDir, "components/mail/reader/MailReaderPane.tsx"),
    "utf8",
  );
  const css = readFileSync(
    path.join(srcDir, "styles/mail-list-return-top.css"),
    "utf8",
  );

  assert.match(pillSource, /aria-hidden=\{!visible\}/);
  assert.match(pillSource, /disabled=\{!visible\}/);
  assert.match(pillSource, /tabIndex=\{visible \? 0 : -1\}/);
  assert.match(readerSource, /className="reader-body"/);
  assert.match(
    readerSource,
    /<ScrollToTopPill[\s\S]*className="reader-return-top"/,
  );
  assert.match(
    css,
    /\.reader-return-top\s*\{[^}]*--scroll-pill-bottom:\s*14px/s,
  );
  assert.match(css, /@media print\s*\{[^}]*\.scroll-to-top-pill/s);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addedMailIds,
  consumeArrivalsAtTop,
  mailListScrollFlags,
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

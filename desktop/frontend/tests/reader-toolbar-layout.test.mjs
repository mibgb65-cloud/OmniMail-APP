import assert from "node:assert/strict";
import { test } from "node:test";
import { getReaderToolbarLayout } from "../src/components/mail/reader/readerToolbarLayout.ts";

test("宽屏窗口打开 AI 后按阅读区实际宽度收纳操作", () => {
  const full = getReaderToolbarLayout(820);
  assert.deepEqual(full.actions, [
    "reply",
    "forward",
    "archive",
    "snooze",
    "label",
  ]);
  const withAi = getReaderToolbarLayout(600 - 2 * 18);
  assert.deepEqual(withAi.actions, ["reply", "archive", "label"]);
  assert.equal(withAi.showCount, false);
  assert.equal(withAi.showDelete, true);
  assert.equal(getReaderToolbarLayout(820), full);
});

test("临界宽度逐级收纳且始终保留回复按钮", () => {
  for (const [width, expectedActionCount, count, directDelete] of [
    [0, 2, false, true],
    [484.9, 2, false, true],
    [485, 3, false, true],
    [629.9, 3, false, true],
    [630, 4, true, true],
    [759.9, 4, true, true],
    [760, 5, true, true],
  ]) {
    const layout = getReaderToolbarLayout(width);
    assert.equal(layout.actions.length, expectedActionCount);
    assert.equal(layout.actions[0], "reply");
    assert.equal(layout.actions.at(-1), "label");
    assert.equal(layout.showCount, count);
    assert.equal(layout.showDelete, directDelete);
  }
});

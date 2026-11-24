import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getReaderToolbarLayout,
  getReaderToolbarRequiredWidth,
} from "../src/components/mail/reader/readerToolbarLayout.ts";

test("截图附近的宽度保留翻译与 AI，按实际占位收纳低频操作", () => {
  const narrow = getReaderToolbarLayout(480 - 2 * 18);
  assert.equal(narrow.density, "compact");
  assert.equal(narrow.aiLabel, "short");
  assert.deepEqual(narrow.actions, ["reply", "label"]);
  assert.equal(narrow.showDelete, true);

  const withAi = getReaderToolbarLayout(600 - 2 * 18);
  assert.equal(withAi.density, "labels");
  assert.equal(withAi.showCount, false);
  assert.deepEqual(withAi.actions, ["reply", "archive", "label"]);

  const wide = getReaderToolbarLayout(820);
  assert.deepEqual(wide.actions, [
    "reply",
    "forward",
    "archive",
    "snooze",
    "label",
  ]);
  assert.equal(wide.showCount, true);
  assert.equal(getReaderToolbarLayout(820), wide);
});

test("收纳断点只在固定占位全部放得下时升级", () => {
  for (const threshold of [236, 272, 328, 396, 454, 554, 624, 714, 784]) {
    const smaller = getReaderToolbarLayout(threshold - 0.1);
    const larger = getReaderToolbarLayout(threshold);
    assert.notEqual(smaller, larger);
    assert.equal(getReaderToolbarRequiredWidth(larger), threshold);
    assert.ok(
      smaller.actions.every((action) => larger.actions.includes(action)),
    );
  }

  for (let width = 200; width <= 900; width += 0.5) {
    assert.ok(
      getReaderToolbarRequiredWidth(getReaderToolbarLayout(width)) <= width,
    );
  }
});

test("极窄时先让常规操作和删除进入更多菜单，不扩展工具栏最小占位", () => {
  const minimum = getReaderToolbarLayout(200);
  assert.equal(getReaderToolbarLayout(0), minimum);
  assert.equal(getReaderToolbarLayout(199), minimum);
  assert.deepEqual(minimum.actions, []);
  assert.equal(minimum.showDelete, false);
  assert.equal(minimum.aiLabel, "icon");
  assert.equal(getReaderToolbarRequiredWidth(minimum), 200);
});

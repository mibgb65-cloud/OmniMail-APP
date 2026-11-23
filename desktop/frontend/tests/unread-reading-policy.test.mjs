import assert from "node:assert/strict";
import { test } from "node:test";
import {
  keepUnreadListItem,
  openedUnreadId,
  previewMail,
  shouldReloadOnMailDelta,
} from "../src/state/mailReadingPolicy.ts";

test("切换账户或未读筛选时，预览第一封不更改任何未读状态", () => {
  const original = [
    { id: "gmail-1", unread: true },
    { id: "gmail-2", unread: true },
  ];
  assert.equal(previewMail(original, original, "other-account").id, "gmail-1");
  assert.equal(
    original.every((item) => item.unread),
    true,
  );
  assert.equal(previewMail([], [], "gmail-1"), null);
});

test("打开邮件只产生目标邮件的已读意图；停留在该未读列表时不移走该行", () => {
  const items = [
    { id: "first", unread: true },
    { id: "opened", unread: true },
    { id: "third", unread: true },
  ];
  const target = openedUnreadId(items, "opened");
  assert.equal(target, "opened");
  items[1].unread = false;
  assert.equal(openedUnreadId(items, "opened"), undefined);
  assert.equal(openedUnreadId(items, "not-in-list"), undefined);
  assert.equal(previewMail(items, items, "opened").id, "opened");
  assert.deepEqual(
    items.filter((item) => keepUnreadListItem(item, new Set([target]))),
    items,
  );
  assert.deepEqual(
    items.filter((item) => keepUnreadListItem(item)),
    [items[0], items[2]],
  );
});

test("未读视图收到后台变化不重查列表，其他列表仍可实时更新", () => {
  assert.equal(shouldReloadOnMailDelta("unread"), false);
  for (const tab of ["all", "starred", "attachments"]) {
    assert.equal(shouldReloadOnMailDelta(tab), true);
  }
});

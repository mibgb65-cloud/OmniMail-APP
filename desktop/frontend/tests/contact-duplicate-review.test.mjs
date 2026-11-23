import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMergePlan,
  duplicatePreview,
  groupSelection,
  sortedCandidates,
  visibleDuplicateCandidates,
} from "../src/components/contacts/duplicates/duplicateSelection.ts";

const makeGroup = (key, count, name = "通知组") => ({
  key,
  candidates: Array.from({ length: count }, (_, i) => ({
    id: `${key}-${i}`,
    name,
    email: `noreply_at_${"x".repeat(44)}_${i}@icloud.com`,
    mailCount: i,
  })),
});

test("50 条长地址的组默认仅显示两条且按往来封数倒序", () => {
  const group = makeGroup("large", 50);
  const sorted = sortedCandidates(group.candidates);
  assert.equal(groupSelection(group).primaryId, "large-49");
  assert.deepEqual(
    visibleDuplicateCandidates(sorted, false).map((c) => c.id),
    ["large-49", "large-48"],
  );
  assert.equal(visibleDuplicateCandidates(sorted, true).length, 50);
});

test("全选默认保留主邮箱；换主邮箱和排除地址后精简数准确", () => {
  const group = makeGroup("large", 50);
  const selection = groupSelection(group);
  assert.equal(createMergePlan(group, selection).duplicateIds.length, 49);
  const chosen = createMergePlan(group, {
    ...selection,
    primaryId: "large-1",
    excluded: ["large-2", "large-4"],
  });
  assert.equal(chosen.primaryId, "large-1");
  assert.equal(chosen.duplicateIds.length, 47);
  assert.equal(chosen.duplicateIds.includes("large-49"), true);
  assert.equal(chosen.duplicateIds.includes("large-2"), false);
  assert.equal(
    createMergePlan(group, { ...selection, primaryId: "other" }),
    null,
  );
});

test("顶部只预览三组名称与数量，不暴露超长邮箱", () => {
  const groups = [
    makeGroup("large", 50),
    makeGroup("second", 3, "noreply@example.com"),
    makeGroup("third", 2, "林知夏"),
    makeGroup("fourth", 2, "第四组"),
  ];
  const { preview, emailCount } = duplicatePreview(groups);
  assert.equal(emailCount, 57);
  assert.equal(
    preview,
    "包含：通知组（50 个邮箱）、未命名联系人（3 个邮箱）、林知夏（2 个邮箱）…",
  );
  assert.doesNotMatch(preview, /@|icloud|第四组/);
});

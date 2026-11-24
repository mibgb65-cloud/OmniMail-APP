import assert from "node:assert/strict";
import test from "node:test";
import { updateScopedTranslation } from "../src/components/mail/translation/translationSessionCache.ts";
import {
  applyTranslationBatch,
  canReuseTranslation,
  finishTranslation,
  startTranslation,
} from "../src/components/mail/translation/translationStreamState.ts";

const key = {
  profileId: "profile-a",
  mailId: "mail-a",
  requestId: "request-a",
};
const options = {
  source: "auto",
  target: "zh-CN",
  mode: "translated",
  includeSubject: true,
};
const first = {
  ...key,
  source: "en",
  subject: "更新主题",
  segments: { "First paragraph": "第一段" },
  completedBatches: 1,
  totalBatches: 2,
};

test("同一封邮件同样的选项，切换引擎时不复用完整或部分译文", () => {
  const started = startTranslation(key, options, "bilibili");
  const complete = finishTranslation(started, {
    ...first,
    completedBatches: 2,
  });
  assert.equal(canReuseTranslation(complete, options, "bilibili"), true);
  assert.equal(canReuseTranslation(complete, options, "ai"), false);
  const partial = finishTranslation(started, first);
  const nextKey = { ...key, requestId: "request-b" };
  const switched = startTranslation(nextKey, options, "ai", partial);
  assert.deepEqual(switched.result.content.segments, {});
  assert.equal(switched.result.content.subject, "");
  assert.equal(applyTranslationBatch(switched, first), switched);
});

test("切换邮件只更新原邮件项，切换工作空间和旧请求事件不可覆盖当前译文", () => {
  const token = {};
  const old = startTranslation(key, options, "bilibili");
  const nextKey = { ...key, mailId: "mail-b" };
  const next = startTranslation(nextKey, options, "bilibili");
  const state = { token, entries: { "mail-a": old, "mail-b": next } };
  const update = (entry) => applyTranslationBatch(entry, first);
  const delayed = updateScopedTranslation(state, token, key.mailId, update);
  assert.equal(delayed.entries["mail-b"], next);
  assert.equal(delayed.entries["mail-a"].result.content.subject, first.subject);
  assert.equal(
    updateScopedTranslation(state, token, nextKey.mailId, update),
    state,
  );
  assert.equal(
    applyTranslationBatch(old, { ...first, profileId: "profile-b" }),
    old,
  );
  const switchedBack = { ...state, token: {} };
  assert.equal(
    updateScopedTranslation(switchedBack, token, key.mailId, update),
    switchedBack,
  );
});

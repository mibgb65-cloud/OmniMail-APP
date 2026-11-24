import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasUsableSummary,
  scheduleAutoMailSummary,
} from "./autoMailSummary.ts";

function pendingCache() {
  let finish!: (value: null) => void;
  const promise = new Promise<null>((resolve) => {
    finish = resolve;
  });
  return { promise, finish: () => finish(null) };
}

test("自动摘要至少防抖 300ms，并等待 SQLite 缓存判定", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const cache = pendingCache();
  scheduleAutoMailSummary(cache.promise, "zh-CN", () => calls++);
  t.mock.timers.tick(299);
  await Promise.resolve();
  assert.equal(calls, 0);
  t.mock.timers.tick(1);
  await Promise.resolve();
  assert.equal(calls, 0);
  cache.finish();
  await cache.promise;
  assert.equal(calls, 1);
});

test("切信或收起侧栏后，即使旧邮件缓存查询完成也不再发起摘要", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const cache = pendingCache();
  const started: string[] = [];
  const leave = scheduleAutoMailSummary(cache.promise, "zh-CN", () =>
    started.push("旧邮件"),
  );
  t.mock.timers.tick(300);
  leave();
  scheduleAutoMailSummary(Promise.resolve(null), "zh-CN", () =>
    started.push("新邮件"),
  );
  cache.finish();
  t.mock.timers.tick(300);
  await cache.promise;
  assert.deepEqual(started, ["新邮件"]);
});

test("有效摘要、旧版无语言摘要和读取失败均不触发模型", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  for (const cached of [
    { summary: "本地摘要", summaryLanguage: "zh-CN" },
    { summary: "旧版摘要" },
    undefined,
  ]) {
    scheduleAutoMailSummary(Promise.resolve(cached), "zh-CN", () => calls++);
  }
  t.mock.timers.tick(300);
  await Promise.resolve();
  assert.equal(calls, 0);
});

test("无缓存、仅拟稿和空白摘要不点亮摘要状态，也不阻止自动摘要", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const draftOnly = { summary: "", draftReply: "这是草稿，不是摘要" };
  let calls = 0;
  for (const insight of [null, draftOnly, { summary: " \r\n" }]) {
    assert.equal(hasUsableSummary(insight), false);
    scheduleAutoMailSummary(Promise.resolve(insight), "zh-CN", () => calls++);
  }
  t.mock.timers.tick(300);
  await Promise.resolve();
  assert.equal(calls, 3);
  assert.equal(hasUsableSummary({ summary: "一封真实摘要" }), true);
});

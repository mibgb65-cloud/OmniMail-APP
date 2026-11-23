import assert from "node:assert/strict";
import test from "node:test";
import { createBodyTranslationRenderer } from "../src/components/mail/translation/translatedText.ts";
import { runTranslationRequest } from "../src/components/mail/translation/translationRequest.ts";
import { updateScopedTranslation } from "../src/components/mail/translation/translationSessionCache.ts";
import {
  applyTranslationBatch,
  canReuseTranslation,
  changeTranslationMode,
  failTranslation,
  finishTranslation,
  matchesTranslationRequest,
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
  segments: { "First paragraph": "第一段", "Mail subject": "更新主题" },
  completedBatches: 1,
  totalBatches: 2,
};
const second = {
  ...key,
  source: "en",
  segments: { "Second paragraph": "第二段" },
  completedBatches: 2,
  totalBatches: 2,
};
const complete = {
  ...second,
  subject: first.subject,
  segments: { ...first.segments, ...second.segments },
};

function fakeMailBody() {
  const container = { closest: () => null };
  const spans = new Map();
  const nodes = ["First paragraph", "Second paragraph"].map((data, index) => ({
    data,
    parentElement: container,
    after: (span) => {
      spans.set(index, span);
    },
  }));
  const document = {
    createTreeWalker() {
      let i = -1;
      return {
        get currentNode() {
          return nodes[i];
        },
        nextNode: () => nodes[++i],
      };
    },
    createElement() {
      return {
        remove() {
          for (const [index, span] of spans)
            if (span === this) spans.delete(index);
        },
      };
    },
  };
  const inner = Object.assign(container, { ownerDocument: document });
  const before = globalThis.NodeFilter;
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  try {
    return { nodes, spans, render: createBodyTranslationRenderer(inner) };
  } finally {
    globalThis.NodeFilter = before;
  }
}

test("第二批挂起时第一批的标题和正文已进入渲染，第二段保持原文", async () => {
  const body = fakeMailBody();
  let entry = startTranslation(key, options);
  let listener;
  let subscribedBeforeCall = false;
  let unsubscribed = false;
  let finish;
  const waitingForSecond = new Promise((resolve) => {
    finish = resolve;
  });
  const running = runTranslationRequest(
    key,
    (handler) => {
      listener = handler;
      return () => {
        unsubscribed = true;
      };
    },
    () => {
      subscribedBeforeCall = typeof listener === "function";
      listener(first);
      return waitingForSecond;
    },
    (batch) => {
      entry = applyTranslationBatch(entry, batch);
      body.render(
        entry.mode === "original"
          ? undefined
          : {
              mode: entry.mode,
              ...entry.result.content,
            },
      );
    },
    matchesTranslationRequest,
  );

  assert.equal(subscribedBeforeCall, true);
  assert.equal(unsubscribed, false);
  assert.equal(entry.phase, "pending");
  assert.equal(entry.result.content.subject, "更新主题");
  assert.deepEqual(
    body.nodes.map((node) => node.data),
    ["第一段", "Second paragraph"],
  );
  entry = changeTranslationMode(entry, "original");
  body.render();
  listener(second);
  assert.equal(entry.mode, "original");
  assert.deepEqual(
    body.nodes.map((node) => node.data),
    ["First paragraph", "Second paragraph"],
  );
  finish(complete);
  entry = finishTranslation(entry, await running);
  assert.equal(unsubscribed, true);
  assert.equal(entry.mode, "original");
  assert.equal(entry.result.content.segments["Second paragraph"], "第二段");
});

test("双语仅追加已完成段落；后续批次不会替换已有双语节点", () => {
  const body = fakeMailBody();
  body.render({ mode: "bilingual", target: "zh-CN", segments: first.segments });
  assert.equal(body.spans.size, 1);
  const firstSpan = body.spans.get(0);
  body.render({
    mode: "bilingual",
    target: "zh-CN",
    segments: complete.segments,
  });
  assert.equal(body.spans.get(0), firstSpan);
  assert.equal(body.spans.get(1).textContent, " 第二段");
  assert.deepEqual(
    body.nodes.map((node) => node.data),
    ["First paragraph", "Second paragraph"],
  );
});

test("部分失败、终态先到与重试不会丢失有效译文或误标完整缓存", () => {
  const started = startTranslation(key, options);
  const partial = finishTranslation(started, first);
  assert.equal(partial.phase, "partial");
  assert.equal(partial.result.content.segments["First paragraph"], "第一段");
  assert.equal(canReuseTranslation(partial, options), false);
  assert.equal(applyTranslationBatch(partial, first), partial);
  const retryKey = { ...key, requestId: "retry" };
  const retried = startTranslation(
    retryKey,
    options,
    changeTranslationMode(partial, "original"),
    true,
  );
  assert.equal(retried.mode, "original");
  assert.equal(retried.completedBatches, 0);
  assert.equal(retried.result.content.subject, first.subject);
  assert.equal(applyTranslationBatch(retried, first), retried);
  assert.equal(failTranslation(retried, retryKey, "网络失败").phase, "partial");
  const final = finishTranslation(retried, { ...complete, ...retryKey });
  assert.equal(canReuseTranslation(final, options), true);
  assert.deepEqual(final.result.content.segments, complete.segments);
  assert.equal(applyTranslationBatch(final, { ...first, ...retryKey }), final);
});

test("切换邮件只更新原邮件项，切换工作空间和旧请求事件不可覆盖当前译文", () => {
  const token = {};
  const old = startTranslation(key, options);
  const nextKey = { ...key, mailId: "mail-b" };
  const next = startTranslation(nextKey, options);
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

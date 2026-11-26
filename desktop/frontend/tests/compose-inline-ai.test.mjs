import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildAppendedDraftBody,
  buildReplacedDraftBody,
  countInlineAiChars,
  createInlineAiSessionTracker,
  deriveComposeAiLockState,
  INLINE_AI_PRESETS,
  resolveInlineAiPhase,
} from "../src/components/compose/composeInlineAiLogic.ts";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("生成态锁定判据：busy 时自定义输入框、4 枚预设按钮、只读正文与发送/定时发送均严格锁定", () => {
  assert.equal(INLINE_AI_PRESETS.length, 4);

  const busyLock = deriveComposeAiLockState(true, "formal");
  assert.equal(busyLock.promptDisabled, true);
  assert.equal(busyLock.presetsDisabled, true);
  assert.equal(busyLock.highlightedPreset, "formal");
  assert.equal(busyLock.editorReadOnly, true);
  assert.equal(busyLock.sendDisabled, true);
  assert.equal(busyLock.scheduleDisabled, true);

  const idleLock = deriveComposeAiLockState(false, "formal");
  assert.equal(idleLock.promptDisabled, false);
  assert.equal(idleLock.presetsDisabled, false);
  assert.equal(idleLock.highlightedPreset, null);
  assert.equal(idleLock.editorReadOnly, false);
  assert.equal(idleLock.sendDisabled, false);
  assert.equal(idleLock.scheduleDisabled, false);

  const barSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "compose",
      "ComposeInlineAiBar.tsx",
    ),
    "utf8",
  );
  const footerSrc = readFileSync(
    path.join(rootDir, "src", "components", "compose", "ComposeFooterBar.tsx"),
    "utf8",
  );
  const editorSrc = readFileSync(
    path.join(rootDir, "src", "components", "compose", "ComposeRichEditor.tsx"),
    "utf8",
  );
  // 提交自定义要求时保留正在执行的指令文本，不在回车瞬间清空
  assert.doesNotMatch(barSrc, /submitPrompt[\s\S]{0,120}setPrompt\(""\)/);
  assert.match(barSrc, /disabled=\{lock\.promptDisabled\}/);
  assert.match(barSrc, /disabled=\{lock\.presetsDisabled\}/);
  assert.match(footerSrc, /disabled=\{aiBusy\}/);
  assert.match(editorSrc, /contentEditable=\{!readOnly\}/);
});

test("阶段演进与字数计数：busy && !preview 渲染骨架预热态，busy && preview 渲染流式光标与字数", () => {
  assert.equal(resolveInlineAiPhase(false, ""), "idle");
  assert.equal(resolveInlineAiPhase(true, ""), "warmup");
  assert.equal(resolveInlineAiPhase(true, "   "), "warmup");
  assert.equal(resolveInlineAiPhase(true, "你好，方案已收到"), "streaming");
  assert.equal(resolveInlineAiPhase(false, "你好，方案已收到"), "completed");

  assert.equal(countInlineAiChars(""), 0);
  assert.equal(countInlineAiChars("知夏，你好：\n明天见！"), 10);

  const previewSrc = readFileSync(
    path.join(
      rootDir,
      "src",
      "components",
      "compose",
      "ComposeInlineAiPreview.tsx",
    ),
    "utf8",
  );
  assert.match(previewSrc, /cia-skeleton-line w-92/);
  assert.match(previewSrc, /cia-skeleton-line w-78/);
  assert.match(previewSrc, /cia-skeleton-line w-54/);
  assert.match(previewSrc, /cia-stream-caret/);
});

test("全程可停止与草稿切换隔离：reqId 返回前抢停、流式中停止、Esc 与关闭均正确取消并防串流", () => {
  const cancelledIds = [];
  const tracker = createInlineAiSessionTracker((id) => cancelledIds.push(id));

  // 1) reqId 握手返回前点击「停止生成」：返回后立即补发 cancelRequest 并丢弃后续 chunk
  const seq1 = tracker.startRun("draft-a");
  assert.equal(tracker.stopCurrent(), true);
  assert.equal(tracker.bindRequestId(seq1, "req-early"), false);
  assert.deepEqual(cancelledIds, ["req-early"]);
  assert.equal(tracker.acceptEvent("req-early", "draft-a"), false);

  // 2) 正常流式中点击停止 / Esc：立即调用 cancelRequest 并拒收残余 chunk
  const seq2 = tracker.startRun("draft-a");
  assert.equal(tracker.bindRequestId(seq2, "req-live"), true);
  assert.equal(tracker.acceptEvent("req-live", "draft-a"), true);
  assert.equal(tracker.stopCurrent(), true);
  assert.deepEqual(cancelledIds, ["req-early", "req-live"]);
  assert.equal(tracker.acceptEvent("req-live", "draft-a"), false);

  // 3) 切换 draftId 时拒收旧草稿事件，开启新会话自动取消旧在途请求
  const seq3 = tracker.startRun("draft-a");
  assert.equal(tracker.bindRequestId(seq3, "req-old-draft"), true);
  assert.equal(tracker.acceptEvent("req-old-draft", "draft-b"), false);
  tracker.startRun("draft-b");
  assert.deepEqual(cancelledIds, ["req-early", "req-live", "req-old-draft"]);

  const hookSrc =
    readFileSync(
      path.join(
        rootDir,
        "src",
        "components",
        "compose",
        "useInlineComposeAi.ts",
      ),
      "utf8",
    ) +
    readFileSync(
      path.join(
        rootDir,
        "src",
        "components",
        "compose",
        "useInlineComposeAiEvents.ts",
      ),
      "utf8",
    );
  assert.match(hookSrc, /e\.key === "Escape"/);
  assert.match(hookSrc, /stopImmediatePropagation/);
});

test("采纳闭环：替换当前正文与追加到末尾（保留原正文空一行衔接）均正确生成纯文本与安全 HTML", () => {
  const replaced = buildReplacedDraftBody(
    "  知夏，你好：\n明天 14:00 准时参会。  ",
  );
  assert.equal(replaced.body, "知夏，你好：\n明天 14:00 准时参会。");
  assert.equal(
    replaced.bodyHtml,
    "<div>知夏，你好：</div><div>明天 14:00 准时参会。</div>",
  );

  const appended = buildAppendedDraftBody(
    "第一段原始说明。",
    "<div><strong>第一段原始说明。</strong></div>",
    "补充第二段 AI 结论。",
  );
  assert.equal(appended.body, "第一段原始说明。\n\n补充第二段 AI 结论。");
  assert.equal(
    appended.bodyHtml,
    "<div><strong>第一段原始说明。</strong></div><div><br /></div><div>补充第二段 AI 结论。</div>",
  );

  // 原草稿为空时，「追加到末尾」等价于干净写入，不在顶部留多余空行
  const appendOnEmpty = buildAppendedDraftBody("", "", "直接生成首段。");
  assert.equal(appendOnEmpty.body, "直接生成首段。");
  assert.equal(appendOnEmpty.bodyHtml, "<div>直接生成首段。</div>");
});

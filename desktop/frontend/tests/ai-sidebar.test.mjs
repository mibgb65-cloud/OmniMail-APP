import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { aiMarkdownOptions } from "../src/components/ai/aiMarkdownOptions.ts";
import {
  aiWidthRange,
  clampAiWidth,
} from "../src/components/ai/aiPanelWidth.ts";
import { mailAiScope } from "../src/components/ai/aiPrivacyScope.ts";
import { normalizeSummaryDeadlines } from "../src/components/ai/autoMailSummary.ts";

test("AI 侧栏宽度被限制在工作区可用范围内", () => {
  assert.deepEqual(aiWidthRange(800), { min: 280, max: 640 });
  assert.deepEqual(aiWidthRange(366.9), { min: 280, max: 366 });
  assert.deepEqual(aiWidthRange(234), { min: 234, max: 234 });
  assert.equal(clampAiWidth(600, 280, 366), 366);
  assert.equal(clampAiWidth(600, 280, 640), 600);
  assert.equal(clampAiWidth(Number.NaN, 280, 640), 336);
});

test("AI Markdown 渲染排版，不创建远程图片、链接或原始 HTML", () => {
  const text = [
    "**重要**",
    "- 有序信息",
    "",
    "```txt\nhello\n```",
    "",
    "[示例](https://example.com)",
    "![附件预览](https://example.com/image.png)",
    "<div>原始 HTML</div>",
  ].join("\n");
  const html = renderToStaticMarkup(
    createElement(Markdown, aiMarkdownOptions, text),
  );
  assert.match(html, /<strong>重要<\/strong>/);
  assert.match(html, /<li>有序信息<\/li>/);
  assert.match(html, /<pre><code/);
  assert.match(html, /<span>示例<\/span>/);
  assert.match(html, /<span>附件预览<\/span>/);
  assert.doesNotMatch(html, /<img|href=|src=|原始 HTML/);
});

test("主题开关只改变邮件主题范围，两种状态均不发送附件", () => {
  assert.equal(mailAiScope(false).short, "当前邮件正文 · 附件不外传");
  assert.equal(mailAiScope(true).short, "当前邮件主题与正文 · 附件不外传");
  assert.equal(mailAiScope(false).notShared, mailAiScope(true).notShared);
});

test("关键时间与待办支持自适应折行并过滤空白项，长文本不撑破卡片", () => {
  assert.deepEqual(
    normalizeSummaryDeadlines([
      { label: "  ", timeText: " ", urgent: true },
      {
        label: "  手动续订域名 snipxn.com ",
        timeText: " 2026年12月25日到期；邮件称约一个月后续订 ",
        urgent: true,
      },
      { label: "", timeText: "明天 12:00 前", urgent: false },
    ]),
    [
      {
        label: "手动续订域名 snipxn.com",
        timeText: "2026年12月25日到期；邮件称约一个月后续订",
        urgent: true,
      },
      { label: "", timeText: "明天 12:00 前", urgent: false },
    ],
  );

  const stylesDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/styles",
  );
  const draftCss = readFileSync(path.join(stylesDir, "ai-draft.css"), "utf8");
  assert.match(draftCss, /\.ai-summary-deadline\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(
    draftCss,
    /\.ai-deadline-time\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/s,
  );
  assert.doesNotMatch(
    draftCss,
    /\.ai-deadline-time\s*\{[^}]*flex-shrink:\s*0/s,
  );
});

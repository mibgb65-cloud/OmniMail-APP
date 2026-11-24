import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInlineImageHtml,
  extractPlainTextFromHtml,
  isSafeComposeHref,
  normalizeComposeHref,
  plainTextToComposeHtml,
  sanitizeComposeHtml,
} from "../src/components/compose/composeRichHtml.ts";

test("富文本清洗：剥离 script、style、on* 事件与破坏性布局样式", () => {
  const dirty = [
    '<div style="position:fixed;z-index:9999;top:0" onclick="alert(1)">',
    "<p><strong>重要通知</strong><script>alert('xss')</script></p>",
    "<style>body { display: none; }</style>",
    '<iframe src="https://evil.example"></iframe>',
    '<blockquote onmouseover="steal()">引用内容</blockquote>',
    "</div>",
  ].join("");

  const clean = sanitizeComposeHtml(dirty);
  assert.ok(!clean.includes("<script"));
  assert.ok(!clean.includes("<style"));
  assert.ok(!clean.includes("<iframe"));
  assert.ok(!clean.includes("onclick"));
  assert.ok(!clean.includes("onmouseover"));
  assert.ok(!clean.includes("position:fixed"));
  assert.ok(clean.includes("<strong>重要通知</strong>"));
  assert.ok(clean.includes("<blockquote>引用内容</blockquote>"));
});

test("富文本清洗：仅放行 http/https/mailto 链接与本地 /omnimail-cid/ 内嵌图", () => {
  const html = [
    '<a href="https://docs.omnimail.app/guide">文档</a>',
    '<a href="mailto:team@omnimail.app">联系我们</a>',
    '<a href="javascript:alert(1)">恶意链接</a>',
    '<img src="/omnimail-cid/dimg-101" data-cid="img-1@omnimail.local" alt="截图" onerror="evil()" />',
    '<img src="data:image/png;base64,AAAA" />',
    '<img src="https://tracker.evil.com/pixel.gif" />',
  ].join("");

  const clean = sanitizeComposeHtml(html);
  assert.ok(clean.includes('href="https://docs.omnimail.app/guide"'));
  assert.ok(clean.includes('href="mailto:team@omnimail.app"'));
  assert.ok(!clean.includes("javascript:"));
  assert.ok(
    clean.includes(
      '<img src="/omnimail-cid/dimg-101" data-cid="img-1@omnimail.local" alt="截图" />',
    ),
  );
  assert.ok(!clean.includes("onerror"));
  assert.ok(!clean.includes("data:image/png"));
  assert.ok(!clean.includes("tracker.evil.com"));
});

test("链接协议校验与自动补全", () => {
  assert.equal(isSafeComposeHref("https://example.com"), true);
  assert.equal(isSafeComposeHref("http://example.com/a?b=1"), true);
  assert.equal(isSafeComposeHref("mailto:hi@example.com"), true);
  assert.equal(isSafeComposeHref("javascript:alert(1)"), false);
  assert.equal(isSafeComposeHref("file:///C:/Windows/win.ini"), false);
  assert.equal(isSafeComposeHref("data:text/html,hi"), false);

  assert.equal(
    normalizeComposeHref("omnimail.app/docs"),
    "https://omnimail.app/docs",
  );
  assert.equal(
    normalizeComposeHref("hi@omnimail.app"),
    "mailto:hi@omnimail.app",
  );
  assert.equal(normalizeComposeHref("javascript:void(0)"), null);
});

test("HTML 纯文本提取：保留段落、列表、换行并还原实体", () => {
  const html =
    "<p>你好 &amp; 欢迎</p><ul><li>第一项</li><li>第二项</li></ul><blockquote>引用说明<br/>第二行</blockquote>";
  const text = extractPlainTextFromHtml(html);
  assert.equal(text, "你好 & 欢迎\n• 第一项\n• 第二项\n引用说明\n第二行");
});

test("纯文本转富文本 HTML 并安全转义特殊字符", () => {
  const html = plainTextToComposeHtml("第一行 <tag>\n\n第二行 & 结尾");
  assert.ok(html.includes("&lt;tag&gt;"));
  assert.ok(html.includes("<div><br /></div>"));
  assert.ok(html.includes("第二行 &amp; 结尾"));
  assert.equal(extractPlainTextFromHtml(html), "第一行 <tag>\n\n第二行 & 结尾");
});

test("构建内嵌图片 HTML 标签时转义属性", () => {
  const img = buildInlineImageHtml(
    "/omnimail-cid/dimg-1",
    "cid-1@omnimail.local",
    'screen "1"',
  );
  assert.equal(
    img,
    '<img src="/omnimail-cid/dimg-1" data-cid="cid-1@omnimail.local" alt="screen &quot;1&quot;" />',
  );
});

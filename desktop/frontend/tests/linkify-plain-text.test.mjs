import assert from "node:assert/strict";
import test from "node:test";
import { linkifyPlainText } from "../src/components/mail/reader/linkifyPlainText.ts";
import {
  getMailHtmlThemeCss,
  SHADOW_BASE_CSS,
} from "../src/components/mail/reader/safeMailHtmlStyles.ts";

test("精准识别 http/https 并剥离末尾中英文标点", () => {
  const segs = linkifyPlainText(
    "请查阅 https://github.com/omnimail/app，或访问 http://example.org/docs/v1。",
  );
  assert.deepEqual(segs, [
    { type: "text", text: "请查阅 " },
    {
      type: "url",
      text: "https://github.com/omnimail/app",
      href: "https://github.com/omnimail/app",
    },
    { type: "text", text: "，或访问 " },
    {
      type: "url",
      text: "http://example.org/docs/v1",
      href: "http://example.org/docs/v1",
    },
    { type: "text", text: "。" },
  ]);

  const quoted = linkifyPlainText("详见「https://example.com/release」！");
  assert.deepEqual(quoted, [
    { type: "text", text: "详见「" },
    {
      type: "url",
      text: "https://example.com/release",
      href: "https://example.com/release",
    },
    { type: "text", text: "」！" },
  ]);
});

test("正确区分括号包裹 URL 与网址内部的成对括号", () => {
  const wrapped = linkifyPlainText("文档地址 (https://example.com/guide).");
  assert.deepEqual(wrapped, [
    { type: "text", text: "文档地址 (" },
    {
      type: "url",
      text: "https://example.com/guide",
      href: "https://example.com/guide",
    },
    { type: "text", text: ")." },
  ]);

  const balanced = linkifyPlainText(
    "参考 (https://en.wikipedia.org/wiki/URL_(disambiguation))。",
  );
  assert.deepEqual(balanced, [
    { type: "text", text: "参考 (" },
    {
      type: "url",
      text: "https://en.wikipedia.org/wiki/URL_(disambiguation)",
      href: "https://en.wikipedia.org/wiki/URL_(disambiguation)",
    },
    { type: "text", text: ")。" },
  ]);
});

test("识别 www. 网址并自动补全 https://，且不误匹配前缀黏连词", () => {
  const segs = linkifyPlainText("主页：www.omnimail.dev/download，欢迎体验！");
  assert.deepEqual(segs, [
    { type: "text", text: "主页：" },
    {
      type: "url",
      text: "www.omnimail.dev/download",
      href: "https://www.omnimail.dev/download",
    },
    { type: "text", text: "，欢迎体验！" },
  ]);
});

test("识别邮箱地址并在双语段落中同时识别 URL 与邮箱", () => {
  const bilingual = linkifyPlainText(
    "Contact support@omnimail.dev or visit www.omnimail.dev/help (联系 ops+1@corp.co.uk).",
  );
  assert.deepEqual(bilingual, [
    { type: "text", text: "Contact " },
    {
      type: "email",
      text: "support@omnimail.dev",
      email: "support@omnimail.dev",
      href: "mailto:support@omnimail.dev",
    },
    { type: "text", text: " or visit " },
    {
      type: "url",
      text: "www.omnimail.dev/help",
      href: "https://www.omnimail.dev/help",
    },
    { type: "text", text: " (联系 " },
    {
      type: "email",
      text: "ops+1@corp.co.uk",
      email: "ops+1@corp.co.uk",
      href: "mailto:ops+1@corp.co.uk",
    },
    { type: "text", text: ")." },
  ]);
});

test("XSS 文本与非安全协议保持纯文本输出，绝不产生可执行链接", () => {
  const xss =
    "<script>alert(1)</script> javascript:alert(1) data:text/html,<b>hi</b>";
  const segs = linkifyPlainText(xss);
  assert.deepEqual(segs, [{ type: "text", text: xss }]);
});

test("暗黑模式 Shadow DOM 双模式样式：护眼适配不反色媒体，原始白底保真", () => {
  assert.match(
    getMailHtmlThemeCss("light", "adaptive"),
    /:host,\s*\.mail-html-inner\s*\{\s*color-scheme:\s*light;\s*\}/i,
  );
  assert.match(
    getMailHtmlThemeCss("light", "paper"),
    /:host,\s*\.mail-html-inner\s*\{\s*color-scheme:\s*light;\s*\}/i,
  );

  const adaptive = getMailHtmlThemeCss("dark", "adaptive");
  assert.match(adaptive, /#E2E8F0/i);
  assert.match(adaptive, /#60A5FA/i);
  assert.match(adaptive, /img,\s*video,\s*svg,\s*canvas/);
  assert.match(adaptive, /filter:\s*none\s*!important/i);
  assert.doesNotMatch(adaptive, /invert\(/i);

  const paper = getMailHtmlThemeCss("dark", "paper");
  assert.match(paper, /#FAFBFD/i);
  assert.match(paper, /#0F172A/i);
  assert.match(paper, /color-scheme:\s*light/i);
  assert.match(paper, /border-radius:\s*12px/i);
  assert.match(paper, /padding:\s*20px/i);
});

test("Shadow DOM 基础样式：避免 word-break: break-word 压扁表格列头为单字母竖排", () => {
  assert.doesNotMatch(SHADOW_BASE_CSS, /word-break:\s*break-word/i);
  assert.match(SHADOW_BASE_CSS, /:host\s*\{[^}]*overflow-wrap:\s*break-word/is);
  assert.match(SHADOW_BASE_CSS, /:host\s*\{[^}]*word-break:\s*normal/is);
  assert.match(
    SHADOW_BASE_CSS,
    /table,\s*th,\s*td\s*\{\s*word-break:\s*normal;\s*overflow-wrap:\s*normal;\s*\}/i,
  );
});

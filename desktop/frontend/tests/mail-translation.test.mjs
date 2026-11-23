import assert from "node:assert/strict";
import test from "node:test";
import {
  detectMailLanguage,
  languageCode,
} from "../src/components/mail/translation/translationLanguages.ts";
import {
  applyBodyTranslation,
  translatedSegment,
} from "../src/components/mail/translation/translatedText.ts";

test("邮件语言识别在本地完成，界面标签使用简短代码", () => {
  assert.equal(
    detectMailLanguage(
      "This is the newest release. Please review all of the production files before the scheduled deployment.",
    ),
    "en",
  );
  assert.equal(
    detectMailLanguage("このメールはお客様への新しいお知らせです。"),
    "ja",
  );
  assert.equal(
    detectMailLanguage("你好，请在周五之前确认此次发布的所有内容。"),
    "zh-CN",
  );
  assert.equal(detectMailLanguage("https://example.com"), "auto");
  assert.equal(languageCode("zh-CN"), "ZH");
});

test("按原始片段精确匹配，忽略字典原型与不变片段", () => {
  const dictionary = JSON.parse(
    '{"Read more":"查看详情","v0.1":"v0.1","Try it":"<img src=x>"}',
  );
  assert.equal(translatedSegment(" Read more\n", dictionary), "查看详情");
  assert.equal(translatedSegment("v0.1", dictionary), undefined);
  assert.equal(translatedSegment("toString", dictionary), undefined);
  assert.equal(translatedSegment("Try it", dictionary), "<img src=x>");
});

test("双语与仅译文均可还原，模型输出中的 HTML 仅作为文字", () => {
  const container = { closest: () => null };
  const spans = new Set();
  const node = {
    data: " Read more ",
    parentElement: container,
    after: (value) => spans.add(value),
  };
  const document = {
    createTreeWalker: () => ({
      currentNode: node,
      visited: false,
      nextNode() {
        if (this.visited) return null;
        this.visited = true;
        return node;
      },
    }),
    createElement: () => ({
      remove() {
        spans.delete(this);
      },
    }),
  };
  const inner = Object.assign(container, { ownerDocument: document });
  const originalNodeFilter = globalThis.NodeFilter;
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  try {
    const params = {
      segments: { "Read more": "<img src=x>" },
      target: "zh-CN",
    };
    const restoreTranslated = applyBodyTranslation(inner, {
      ...params,
      mode: "translated",
    });
    assert.equal(node.data, " <img src=x> ");
    restoreTranslated();
    assert.equal(node.data, " Read more ");
    const restoreBilingual = applyBodyTranslation(inner, {
      ...params,
      mode: "bilingual",
    });
    assert.equal(node.data, " Read more ");
    const [span] = spans;
    assert.equal(span.textContent, " <img src=x>");
    assert.equal(span.innerHTML, undefined);
    restoreBilingual();
    assert.equal(spans.size, 0);
  } finally {
    globalThis.NodeFilter = originalNodeFilter;
  }
});

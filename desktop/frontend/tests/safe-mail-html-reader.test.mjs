import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { normalizeMailHtmlColorScheme } from "../src/components/mail/reader/safeMailHtmlColorScheme.ts";
import {
  attachShadowImageEnhancements,
  isHiddenOrTrackingPixel,
} from "../src/components/mail/reader/safeMailHtmlImages.ts";
import { getMailHtmlThemeCss } from "../src/components/mail/reader/safeMailHtmlStyles.ts";
import { createFakeRoot } from "./helpers/fakeShadowRoot.mjs";

test("1x1 追踪像素与 display:none 信标加载失败时静默隐藏，不渲染 .omnimail-img-fallback", () => {
  const { doc, root } = createFakeRoot();

  const metaPixel = doc.createElement("img");
  metaPixel.setAttribute("src", "https://auth.meta.com/collect/?ndid=12345");
  metaPixel.setAttribute("style", "border:0;width:1px;height:1px;");

  const hiddenBeacon = doc.createElement("img");
  hiddenBeacon.setAttribute(
    "src",
    "https://count.mail.163.com/beacon/upoint.gif",
  );
  hiddenBeacon.setAttribute("style", "display:none");

  const blockedRemote = doc.createElement("img");
  blockedRemote.setAttribute(
    "data-omnimail-src",
    "https://img.example.com/banner.png",
  );

  const responsiveHero = doc.createElement("img");
  responsiveHero.setAttribute("src", "https://img.example.com/hero.png");
  responsiveHero.setAttribute("style", "width:100%;height:auto;");

  root.append(metaPixel, hiddenBeacon, blockedRemote, responsiveHero);

  assert.equal(isHiddenOrTrackingPixel(metaPixel), true);
  assert.equal(isHiddenOrTrackingPixel(hiddenBeacon), true);
  assert.equal(isHiddenOrTrackingPixel(responsiveHero), false);

  attachShadowImageEnhancements(root, {
    fallbackText: "内嵌图片暂未缓存或加载失败",
    remoteFallbackText: "远程图片加载失败",
    retryLabel: "重试",
    retryingLabel: "正在加载…",
    defaultImageName: "正文图片",
    bodySourceLabel: "邮件正文内嵌图",
  });

  metaPixel.dispatch("error");
  hiddenBeacon.dispatch("error");
  blockedRemote.dispatch("error");

  assert.equal(metaPixel.style.display, "none");
  assert.equal(hiddenBeacon.style.display, "none");
  const fallbacksAfterPixels = root.children.filter((c) =>
    c.classList.contains("omnimail-img-fallback"),
  );
  assert.equal(fallbacksAfterPixels.length, 0);
});

test("区分普通远程图片失败与缺失 CID 内嵌图失败文案，并均支持点击重试", async () => {
  const { doc, root } = createFakeRoot();

  const remoteImg = doc.createElement("img");
  remoteImg.setAttribute("src", "https://cdn.example.com/diagram.png");

  const missingCidImg = doc.createElement("img");
  missingCidImg.setAttribute("data-omnimail-cid-missing", "1");
  missingCidImg.setAttribute("data-omnimail-cid", "att-cid-99");

  root.append(remoteImg, missingCidImg);

  let retriedCid = "";
  attachShadowImageEnhancements(root, {
    fallbackText: "内嵌图片暂未缓存或加载失败",
    remoteFallbackText: "远程图片加载失败",
    retryLabel: "重试",
    retryingLabel: "正在加载…",
    defaultImageName: "正文图片",
    bodySourceLabel: "邮件正文内嵌图",
    onRetryInlineCid: async (attId) => {
      retriedCid = attId;
    },
  });

  const cidCard = missingCidImg.nextElementSibling;
  assert.ok(cidCard?.classList.contains("omnimail-img-fallback"));
  assert.match(cidCard.collectText(), /内嵌图片暂未缓存或加载失败/);

  remoteImg.dispatch("error");
  const remoteCard = remoteImg.nextElementSibling;
  assert.ok(remoteCard?.classList.contains("omnimail-img-fallback"));
  assert.match(remoteCard.collectText(), /远程图片加载失败/);

  const remoteRetryBtn = remoteCard.children.find(
    (c) => c.tagName === "BUTTON",
  );
  assert.ok(remoteRetryBtn);
  remoteRetryBtn.dispatch("click");
  assert.match(remoteImg.getAttribute("src") ?? "", /retry=\d+/);
  assert.equal(
    remoteImg.nextElementSibling?.classList.contains("omnimail-img-fallback") ??
      false,
    false,
  );

  const cidRetryBtn = cidCard.children.find((c) => c.tagName === "BUTTON");
  assert.ok(cidRetryBtn);
  cidRetryBtn.dispatch("click");
  await delay(10);
  assert.equal(retriedCid, "att-cid-99");
  assert.match(
    missingCidImg.getAttribute("src") ?? "",
    /^\/omnimail-cid\/att-cid-99\?retry=/,
  );
});

test("亮色模式返回 color-scheme: light，且存量 prefers-color-scheme: dark 邮件在亮色下不命中暗色背景", () => {
  const lightCss = getMailHtmlThemeCss("light", "adaptive");
  assert.match(lightCss, /color-scheme:\s*light/);

  const legacyDiscourseHtml =
    "<style>.mail-html-inner { background: #ffffff; } @media (prefers-color-scheme: dark) { .mail-html-inner { background: #151515 !important } p, td { color: inherit !important } }</style><p>Topic</p>";
  const normalized = normalizeMailHtmlColorScheme(legacyDiscourseHtml);
  assert.doesNotMatch(normalized, /prefers-color-scheme/i);
  assert.match(
    normalized,
    /\.mail-html-inner\[data-theme="dark"\]\[data-html-mode="adaptive"\]\s*\{\s*background:\s*#151515\s*!important\s*\}/,
  );
  assert.doesNotMatch(
    normalized,
    /\.mail-html-inner\[[^\]]+\]\s+\.mail-html-inner/,
  );
});
